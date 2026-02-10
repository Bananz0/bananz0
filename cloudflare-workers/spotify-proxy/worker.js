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
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin');

        // Allow localhost for development
        let allowedOrigin = 'https://glenmuthoka.com';
        if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
            allowedOrigin = origin;
        } else if (origin && origin.endsWith('.glenmuthoka.com')) {
            allowedOrigin = origin;
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
                return await handleAiSummary(request, env, corsHeaders);
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
const SUMMARY_MODEL_PRIORITY = [
    'llama-3.3-70b-versatile',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'qwen/qwen3-32b',
    'openai/gpt-oss-120b',
    'moonshotai/kimi-k2-instruct',
    'groq/compound',
    'groq/compound-mini',
    'llama-3.1-8b-instant',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'openai/gpt-oss-20b',
    'moonshotai/kimi-k2-instruct-0905',
    'allam-2-7b',
    'canopylabs/orpheus-v1-english',
];

async function handleAiSummary(request, env, corsHeaders) {
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

    const summaryTracks = tracks.slice(0, 50); // Use up to 50 tracks for classification
    // Still take a subset for the prompt text to avoid hitting token limits even if they are freeish
    // But since user asked for "revert to initial" 15/50 logic, we will pass them all if possible. 
    // Groq limits are high. Let's pass all 50.
    const trackLines = summaryTracks.map((track, index) => `${index + 1}. ${track.name} - ${track.artist}`).join('\n');

    let moodClass = { label: 'unknown', description: 'mixed vibes' };
    try {
        const token = await getAccessToken(env);
        if (token) {
            // Only classify based on first 15 to save Spotify API calls latency
            const classificationTracks = summaryTracks.slice(0, 15);
            const trackIds = await resolveTrackIds(token, classificationTracks);
            const features = trackIds.length ? await getAudioFeatures(token, trackIds) : [];
            if (features.length) {
                moodClass = classifyMood(features);
            }
        }
    } catch (error) {
        console.error('Spotify audio features failed, falling back to LLM-only mode', error);
    }

    const messages = [
        {
            role: 'system',
            content: 'you write one-line music session summaries about a person named "glen". write in lower-case, casual, witty tone with clever music-related puns or commentary on his taste. use the person name "glen" in every summary. weave in actual track titles or artist names from the provided list to make the puns deeply personal. Example styles:\n- "glen definitely missed the 80s because they called and he answered"\n- "glen is currently the main character in a indie movie with a top-tier soundtrack"\n- "glen is speed-running his favorite albums like he\'s late for a flight"\n- "glen\'s music taste is so eclectic even the algorithm is taking notes"\nreturn only the summary sentence with no quotes, no hashtags, no emojis. use the mood classification as a vibe check. keep it under 20 words.'
        },
        {
            role: 'user',
            content: `Mode: ${mode}\nTrack count: ${trackCount}\nMood: ${moodClass.label} (${moodClass.description})\nTracks:\n${trackLines}\n\nGenerate summary:`
        }
    ];

    const groqResult = await callGroqStream(messages, env);
    if (!groqResult.response) {
        return new Response(
            JSON.stringify({ error: groqResult.error || 'AI summary failed' }),
            { status: groqResult.status || 502, headers: corsHeaders }
        );
    }

    const headers = {
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Expose-Headers': 'X-Model-Used',
        'X-Model-Used': groqResult.model,
    };

    return new Response(groqResult.response.body, {
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
                max_tokens: 120,
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
    return results.filter(Boolean);
}

async function searchTrackId(token, trackName, artistName) {
    try {
        const query = `track:${trackName} artist:${artistName}`;
        const response = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
            {
                headers: { 'Authorization': `Bearer ${token}` },
            }
        );

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        const track = data.tracks?.items?.[0];
        return track?.id || extractSpotifyIdFromUrl(track?.external_urls?.spotify);
    } catch (error) {
        console.error('Track id search error:', error);
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

    const response = await fetch(lastfmUrl);
    const data = await response.json();

    return new Response(JSON.stringify(data), { headers: corsHeaders });
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
