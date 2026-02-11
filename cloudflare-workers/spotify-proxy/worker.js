/**
 * Unified API Proxy Worker
 * 
 * Securely handles both Spotify and Last.fm API authentication server-side.
 * Frontend calls this worker without exposing credentials.
 * 
 * Endpoints:
 * - GET /?type=spotify&artist=<name> → { artistImage: "url" }
 * - GET /?type=spotify&track=<name>&artist=<name> → { albumImage: "url", artistImage: "url" }
 * - GET /?type=lastfm&user=<username>&method=<method> → Last.fm API response
 * - POST /?type=summary → Groq streamed summary
 */

// In-memory token cache (persists across requests within same isolate)
let cachedToken = null;
let tokenExpiry = 0;

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin');

        // Allow localhost for development, and the main domain + its subdomains
        let allowedOrigin = 'https://glenmuthoka.com';
        if (origin) {
            if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
                allowedOrigin = origin;
            } else if (origin.endsWith('glenmuthoka.com') || origin.endsWith('github.io')) {
                allowedOrigin = origin;
            }
        }

        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'GET, OPTIONS, POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': 'application/json',
        };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const type = url.searchParams.get('type') || 'spotify'; // Default to spotify for backward compat

        try {
            if (type === 'summary') {
                return await handleAiSummary(request, env, ctx, corsHeaders);
            } else if (type === 'lastfm') {
                return await handleLastFm(url, env, corsHeaders);
            } else {
                return await handleSpotify(url, env, corsHeaders);
            }
        } catch (error) {
            console.error('Worker error:', error);
            return new Response(
                JSON.stringify({ error: 'Internal server error' }),
                { status: 500, headers: corsHeaders }
            );
        }
    }
};

// ==========================================
// AI SUMMARY (GROQ)
// ==========================================
async function generateCacheKey(tracks, mode) {
    const data = JSON.stringify({ tracks, mode });
    const msgUint8 = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const SUMMARY_MODEL_PRIORITY = [
    'groq/compound',
    'llama-3.3-70b-versatile',
    'groq/compound-mini',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'qwen/qwen3-32b',
    'openai/gpt-oss-120b',
    'moonshotai/kimi-k2-instruct',
    'llama-3.1-8b-instant',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'openai/gpt-oss-20b',
    'moonshotai/kimi-k2-instruct-0905',
    'allam-2-7b',
    'canopylabs/orpheus-v1-english',
];

const SUMMARY_MAX_TOKENS = 60;
const SUMMARY_PROMPT_TRACK_LIMIT = 12;

async function handleAiSummary(request, env, ctx, corsHeaders) {
    if (request.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: corsHeaders }
        );
    }

    if (!env.GROQ_API_KEY) {
        return new Response(
            JSON.stringify({ error: 'Configuration Error: GROQ_API_KEY is missing' }),
            { status: 503, headers: corsHeaders }
        );
    }

    let payload;
    try {
        payload = await request.json();
    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Invalid JSON body' }),
            { status: 400, headers: corsHeaders }
        );
    }

    const rawTracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
    if (!rawTracks.length) {
        return new Response(
            JSON.stringify({ error: 'Missing tracks payload' }),
            { status: 400, headers: corsHeaders }
        );
    }

    const mode = payload?.mode === 'active' ? 'active' : 'session';
    const trackCount = Number(payload?.trackCount) || rawTracks.length;
    const tracks = rawTracks.slice(0, 50).map(track => ({
        name: String(track?.name || '').trim() || 'Unknown',
        artist: String(track?.artist || '').trim() || 'Unknown',
    }));

    const summaryTracks = tracks.slice(0, 50);
    const promptTracks = summaryTracks.slice(0, SUMMARY_PROMPT_TRACK_LIMIT);

    // CACHE CHECK: Protect the wallet from massive traffic spikes
    const cacheKey = await generateCacheKey(summaryTracks, mode);
    const cacheUrl = new URL(`https://cache.glen.muthoka/summary/${cacheKey}`);
    const cache = (typeof caches !== 'undefined' && caches.default) ? caches.default : null;

    if (cache) {
        const cachedResponse = await cache.match(cacheUrl);
        if (cachedResponse) {
            const response = new Response(cachedResponse.body, cachedResponse);
            // Refresh CORS headers and add cache hit info
            Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
            response.headers.set('X-Cache', 'HIT');
            response.headers.set('Access-Control-Expose-Headers', 'X-Cache, X-Model-Used');
            return response;
        }
    }

    let moodClass = { label: 'unknown', description: 'mixed vibes' };
    let dominantEra = 'unknown';
    let trackListForPrompt = '';
    let audioStats = null;

    try {
        const token = await getAccessToken(env);
        if (token) {
            // 1. Get Details for top 15 tracks (IDs and Years)
            const classificationTracks = summaryTracks.slice(0, 15);
            const trackDetails = await resolveTrackIds(token, classificationTracks);
            
            // 2. Extract IDs for audio features
            const trackIds = trackDetails.map(t => t.id);
            
            // 3. Calculate Dominant Era (Math in Worker to save AI tokens)
            const years = trackDetails.map(t => parseInt(t.year)).filter(y => !isNaN(y));
            if (years.length > 0) {
                const avgYear = years.reduce((a, b) => a + b, 0) / years.length;
                if (avgYear < 1980) dominantEra = 'Classic Rock / Oldies';
                else if (avgYear < 1990) dominantEra = '80s Nostalgia';
                else if (avgYear < 2000) dominantEra = '90s Kid';
                else if (avgYear < 2010) dominantEra = '2000s / Millennial';
                else dominantEra = 'Modern / Gen Z';
            }

            // 4. Get Audio Features
            const features = trackIds.length ? await getAudioFeatures(token, trackIds) : [];
            if (features.length) {
                moodClass = classifyMood(features);
                const avg = (key) => features.reduce((sum, item) => sum + (item[key] ?? 0), 0) / features.length;
                audioStats = {
                    valence: avg('valence'),
                    energy: avg('energy'),
                    danceability: avg('danceability'),
                    acousticness: avg('acousticness'),
                    tempo: avg('tempo'),
                };
            }

            // 5. Format the list for the LLM
            trackListForPrompt = promptTracks.map((t, i) => {
                const foundDetail = trackDetails[i]; // Only exists for first 15
                const yearStr = foundDetail ? ` (${foundDetail.year})` : '';
                return `${i + 1}. ${t.name} - ${t.artist}${yearStr}`;
            }).join('\n');

            // 6. Calculate Repetition (Ear-worm detection)
            const trackCounts = {};
            summaryTracks.forEach(t => {
                const key = `${t.name} by ${t.artist}`.toLowerCase();
                trackCounts[key] = (trackCounts[key] || 0) + 1;
            });
            const counts = Object.values(trackCounts);
            const maxReps = counts.length > 0 ? Math.max(...counts) : 0;
            const topTrack = Object.keys(trackCounts).find(k => trackCounts[k] === maxReps);
            const repetitionInfo = maxReps >= 4 ? `earworm detected: ${topTrack} played ${maxReps} times` : 'none';

            // Add repetition to prompt
            trackListForPrompt += `\n\nRepetition: ${repetitionInfo}`;
        }
    } catch (error) {
        console.error('Spotify processing failed', error);
        // Fallback if API fails
        trackListForPrompt = promptTracks.map((t, i) => `${i + 1}. ${t.name} - ${t.artist}`).join('\n');
    }

    const messages = [
        {
            role: 'system',
            content: `You are the consciousness of a witty, slightly dark, and musically-obsessed entity named "glen". 

CRITICAL HIERARCHY:
1. Track #1 is the CURRENT VIBE. It is the absolute priority for the summary.
2. The remaining tracks (#2-12) are just context for "where glen was".
3. If there is an "earworm" (repetition), mention it as a side-effect or addiction, but don't let it override the atmosphere of Track #1.

PERSONALITY:
- Mysterious/Dark: If current track is moody/indie (e.g., Lithe, Mazzy Star).
- Nostalgic/Sharp: If current track is 50s-90s.
- Girly Pop: For upbeat/poppy tracks (e.g., Sabrina Carpenter).
- OG Respect: For Legends (Rock, Classical, Jazz, OGs like Tupac/Biggie).
- Dark Wit: Regarding tragic icons (e.g., Kurt Cobain).
- Language Aware: Use Spanish/French/etc. context if the current track is in those languages.
- Effortful Roasts: Avoid "vibe/energy" clichés. Go for artistic/soulful critiques.

CONSTRAINTS:
- One sentence, lower-case only.
- 13-22 words.
- No quotes, no hashtags, no preface.
- Refer to "glen" in the third person.
- Focus on the *soul* of Track #1 and its contrast with the recent history. Use some inspiration from the other tracks but don't let them overshadow the current vibe. If the current track is a departure from the recent history, highlight that tension. If it's consistent, comment on the addictive nature of glen's musical choices. Always end with a sharp, witty observation about glen's state of mind or artistic taste.`
        },
        {
            role: 'user',
            content: `mode: ${mode}
time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
era: ${dominantEra}
mood: ${moodClass.label} (${moodClass.description})
stats: valence=${audioStats?.valence?.toFixed(2)}, energy=${audioStats?.energy?.toFixed(2)}
tracks (Track 1 is CURRENT):\n${trackListForPrompt}\n
roast/summarize glen:`
        }
    ];

    const groqResult = await callGroqStream(messages, env);
    if (!groqResult.response) {
        return new Response(
            JSON.stringify({ error: groqResult.error || 'AI summary failed' }),
            { status: groqResult.status || 502, headers: corsHeaders }
        );
    }

    // TEE THE STREAM: One for the user (immediate), one for the cache
    const [clientStream, cacheStream] = groqResult.response.body.tee();

    const headers = {
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Expose-Headers': 'X-Model-Used, X-Cache',
        'X-Model-Used': groqResult.model,
        'X-Cache': 'MISS',
    };

    // Store the result in background cache
    if (cache) {
        ctx.waitUntil((async () => {
            const cacheResponse = new Response(cacheStream, {
                headers: {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'public, max-age=14400', // Cache for 4 hours
                    'X-Model-Used': groqResult.model,
                }
            });
            await cache.put(cacheUrl, cacheResponse);
        })());
    }

    return new Response(clientStream, {
        status: groqResult.response.status,
        headers,
    });
}

async function callGroqStream(messages, env) {
    for (const model of SUMMARY_MODEL_PRIORITY) {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model,
                temperature: 0.7,
                max_tokens: SUMMARY_MAX_TOKENS,
                stop: ['\n'],
                stream: true,
                messages,
            }),
        });

        if (response.ok) {
            return { response, model };
        }

        if (response.status === 429 || response.status >= 500) {
            continue;
        }

        const errorText = await response.text();
        return {
            response: null,
            model,
            status: response.status,
            error: errorText || 'Groq API error',
        };
    }

    return {
        response: null,
        model: null,
        status: 503,
        error: 'All summary models are busy. Try again later.',
    };
}

async function resolveTrackIds(token, tracks) {
    const results = await Promise.all(tracks.map(track => searchTrackId(token, track.name, track.artist)));
    return results.filter(Boolean); // Returns array of { id, year }
}

async function searchTrackId(token, trackName, artistName) {
    try {
        // Optimizing query to be more precise
        const query = `track:${trackName} artist:${artistName}`;
        const response = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
            {
                headers: { 'Authorization': `Bearer ${token}` },
            }
        );

        if (!response.ok) return null;

        const data = await response.json();
        const track = data.tracks?.items?.[0];

        if (!track) return null;

        // Extract just the year (YYYY) from release_date (YYYY-MM-DD)
        const year = track.album?.release_date ? track.album.release_date.split('-')[0] : 'unknown';

        return {
            id: track.id || extractSpotifyIdFromUrl(track.external_urls?.spotify),
            year: year
        };
    } catch (error) {
        console.error('Track search error:', error);
        return null;
    }
}

async function getAudioFeatures(token, trackIds) {
    const ids = trackIds.slice(0, 100).join(',');
    if (!ids) return [];

    const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${encodeURIComponent(ids)}`,
        {
            headers: { 'Authorization': `Bearer ${token}` },
        }
    );

    if (!response.ok) {
        throw new Error(`Spotify audio features failed: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data?.audio_features)
        ? data.audio_features.filter(Boolean)
        : [];
}

function classifyMood(features) {
    if (!features.length) {
        return { label: 'unknown', description: 'mixed vibes' };
    }

    const avg = (key) => features.reduce((sum, item) => sum + (item[key] ?? 0), 0) / features.length;
    const valence = avg('valence');
    const energy = avg('energy');
    const danceability = avg('danceability');
    const acousticness = avg('acousticness');

    if (valence < 0.35 && energy < 0.5) {
        return { label: 'melancholic-calm', description: 'sad and slow' };
    }
    if (valence < 0.35 && energy >= 0.5) {
        return { label: 'melancholic-intense', description: 'sad but intense' };
    }
    if (energy > 0.75 && danceability > 0.7) {
        return { label: 'high-energy-dance', description: 'dance floor vibes' };
    }
    if (energy > 0.7 && acousticness < 0.3) {
        return { label: 'rock-aggressive', description: 'rock and punchy' };
    }
    if (acousticness > 0.6) {
        return { label: 'acoustic-chill', description: 'mellow and organic' };
    }
    if (valence > 0.7) {
        return { label: 'upbeat-happy', description: 'cheerful and bright' };
    }

    return { label: 'eclectic', description: 'genre-spanning' };
}

function extractSpotifyIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const parts = url.split('/track/');
    if (parts.length < 2) return null;
    return parts[1].split('?')[0];
}

// ==========================================
// LAST.FM HANDLER
// ==========================================
async function handleLastFm(url, env, corsHeaders) {
    if (!env.LASTFM_API_KEY) {
        return new Response(
            JSON.stringify({ error: 'Configuration Error: LASTFM_API_KEY is missing' }),
            { status: 503, headers: corsHeaders }
        );
    }

    const user = url.searchParams.get('user');
    const method = url.searchParams.get('method') || 'user.getrecenttracks';
    const limit = url.searchParams.get('limit') || '10';

    if (!user) {
        return new Response(
            JSON.stringify({ error: 'Missing user parameter' }),
            { status: 400, headers: corsHeaders }
        );
    }

    const lastfmUrl = `https://ws.audioscrobbler.com/2.0/?method=${method}&user=${encodeURIComponent(user)}&api_key=${env.LASTFM_API_KEY}&format=json&limit=${limit}`;

    try {
        const response = await fetch(lastfmUrl);
        const data = await response.json();

        // Check if Last.fm returned an error in the JSON
        if (data.error) {
            console.error('Last.fm API internal error:', data);
            return new Response(JSON.stringify(data), {
                status: 200, // Still return 200 so frontend can parse the error message
                headers: corsHeaders
            });
        }

        return new Response(JSON.stringify(data), {
            headers: {
                ...corsHeaders,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            }
        });
    } catch (error) {
        console.error('Last.fm fetch error:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to fetch from Last.fm' }),
            { status: 502, headers: corsHeaders }
        );
    }
}

// ==========================================
// SPOTIFY HANDLER
// ==========================================
async function handleSpotify(url, env, corsHeaders) {
    // Check for missing secrets
    if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
        return new Response(
            JSON.stringify({ error: 'Configuration Error: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is missing' }),
            { status: 503, headers: corsHeaders }
        );
    }

    const artist = url.searchParams.get('artist');
    const track = url.searchParams.get('track');

    if (!artist && !track) {
        return new Response(
            JSON.stringify({ error: 'Missing artist or track parameter' }),
            { status: 400, headers: corsHeaders }
        );
    }

    // Get access token
    const token = await getAccessToken(env);
    if (!token) {
        return new Response(
            JSON.stringify({ error: 'Failed to authenticate with Spotify' }),
            { status: 500, headers: corsHeaders }
        );
    }

    // If track is provided, search for track (includes album art)
    if (track && artist) {
        const result = await searchTrack(token, track, artist);
        return new Response(JSON.stringify(result), { headers: corsHeaders });
    }

    // Otherwise search for artist only
    if (artist) {
        const result = await searchArtist(token, artist);
        return new Response(JSON.stringify(result), { headers: corsHeaders });
    }

    return new Response(
        JSON.stringify({ error: 'Invalid request' }),
        { status: 400, headers: corsHeaders }
    );
}

async function getAccessToken(env) {
    // Check cache
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    const clientId = env.SPOTIFY_CLIENT_ID;
    const clientSecret = env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error('Missing Spotify credentials in environment');
        return null;
    }

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret),
            },
            body: 'grant_type=client_credentials',
        });

        if (!response.ok) {
            console.error('Spotify auth failed:', response.status);
            return null;
        }

        const data = await response.json();
        cachedToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer

        return cachedToken;
    } catch (error) {
        console.error('Token fetch error:', error);
        return null;
    }
}

async function searchArtist(token, artistName) {
    try {
        const response = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
            {
                headers: { 'Authorization': `Bearer ${token}` },
            }
        );

        if (!response.ok) {
            return { artistImage: null };
        }

        const data = await response.json();
        const artist = data.artists?.items?.[0];

        if (artist?.images?.length > 0) {
            // Return medium-sized image (index 1) or largest available
            return {
                artistImage: artist.images[1]?.url || artist.images[0]?.url,
                artistName: artist.name,
                spotifyUrl: artist.external_urls?.spotify,
            };
        }

        return { artistImage: null };
    } catch (error) {
        console.error('Artist search error:', error);
        return { artistImage: null };
    }
}

async function searchTrack(token, trackName, artistName) {
    try {
        const query = `track:${trackName} artist:${artistName}`;
        const response = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
            {
                headers: { 'Authorization': `Bearer ${token}` },
            }
        );

        if (!response.ok) {
            return { albumImage: null, artistImage: null };
        }

        const data = await response.json();
        const track = data.tracks?.items?.[0];

        if (track) {
            // Also fetch artist image
            const artistResult = await searchArtist(token, artistName);

            return {
                albumImage: track.album?.images?.[0]?.url || null,
                artistImage: artistResult.artistImage,
                spotifyUrl: track.external_urls?.spotify,
                spotifyId: track.id || extractSpotifyIdFromUrl(track.external_urls?.spotify),
                trackName: track.name,
                artistName: track.artists?.[0]?.name,
                albumName: track.album?.name,
            };
        }

        return { albumImage: null, artistImage: null };
    } catch (error) {
        console.error('Track search error:', error);
        return { albumImage: null, artistImage: null };
    }
}

