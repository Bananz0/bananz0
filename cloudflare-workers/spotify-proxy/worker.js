/**
 * Unified API Proxy Worker
 * 
 * Unified metadata + Last.fm + AI summary proxy.
 * Frontend calls this worker without exposing credentials.
 * 
 * Endpoints:
 * - GET /?type=spotify&artist=<name> → { artistImage: "url" }
 * - GET /?type=spotify&track=<name>&artist=<name> → { albumImage: "url", artistImage: "url" }
 * - GET /?type=lastfm&user=<username>&method=<method> → Last.fm API response
 * - POST /?type=summary → Groq streamed summary
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin');

        // Allow localhost for development, and the main domain + its subdomains
        const ALLOWED_ORIGINS = [
            'https://glenmuthoka.com',
            'https://www.glenmuthoka.com',
            'https://bananz0.github.io',
        ];
        let allowedOrigin = 'https://glenmuthoka.com';
        if (origin) {
            if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
                allowedOrigin = origin;
            } else if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.glenmuthoka.com')) {
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
const RECCOBEATS_BASE_URL = 'https://api.reccobeats.com';
const CACHE_BASE_URL = 'https://cache.glen.muthoka';
const SUMMARY_CACHE_TTL_SECONDS = 3600;
const METADATA_CACHE_TTL_SECONDS = 21600;
const LASTFM_NOWPLAYING_CACHE_TTL_SECONDS = 10;
const LASTFM_DEFAULT_CACHE_TTL_SECONDS = 120;
const SUMMARY_MAX_MODEL_ATTEMPTS = 4;
const SUMMARY_MAX_TRANSIENT_FAILURES = 2;

function getWorkerCache() {
    return (typeof caches !== 'undefined' && caches.default) ? caches.default : null;
}

function buildCachePath(...parts) {
    return parts.map(part => encodeURIComponent(String(part ?? ''))).join('/');
}

async function getCachedJson(cachePath, ttlSeconds, loader) {
    const cache = getWorkerCache();
    const cacheUrl = new URL(`${CACHE_BASE_URL}/${cachePath}`);

    if (cache) {
        const cached = await cache.match(cacheUrl);
        if (cached) {
            try {
                return await cached.json();
            } catch (error) {
                console.warn(`Failed to parse cached JSON for ${cachePath}`, error);
            }
        }
    }

    const data = await loader();
    if (data != null && cache) {
        const response = new Response(JSON.stringify(data), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${ttlSeconds}`,
            }
        });
        await cache.put(cacheUrl, response);
    }

    return data;
}

function cleanTrackNameForMatch(trackName) {
    return String(trackName || '')
        .replace(/\(feat\..*?\)/gi, '')
        .replace(/\[feat\..*?\]/gi, '')
        .replace(/\s*-\s*.*?(remaster|mix|version|edit).*/gi, '')
        .replace(/\(.*?(remaster|mix|version|edit).*?\)/gi, '')
        .trim();
}

function normalizeForMatch(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

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
        spotifyUrl: String(track?.spotifyUrl || '').trim() || null,
    }));

    const summaryTracks = tracks.slice(0, 50);
    const promptTracks = summaryTracks.slice(0, SUMMARY_PROMPT_TRACK_LIMIT);

    // CACHE CHECK: Protect the wallet from massive traffic spikes
    const cacheKey = await generateCacheKey(summaryTracks, mode);
    const cacheUrl = new URL(`${CACHE_BASE_URL}/summary/${cacheKey}`);
    const cache = getWorkerCache();

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
        // 1. Resolve ReccoBeats metadata for top 15 tracks
        const classificationTracks = summaryTracks.slice(0, 15);
        const trackDetails = await resolveTrackIds(classificationTracks);

        // 2. Extract Spotify IDs for audio features
        const trackIds = trackDetails.map(t => t?.id).filter(Boolean);
            
            // 3. Calculate Dominant Era (Math in Worker to save AI tokens)
            const years = trackDetails.map(t => parseInt(t?.year)).filter(y => !isNaN(y));
            if (years.length > 0) {
                const avgYear = years.reduce((a, b) => a + b, 0) / years.length;
                if (avgYear < 1980) dominantEra = 'Classic Rock / Oldies';
                else if (avgYear < 1990) dominantEra = '80s Nostalgia';
                else if (avgYear < 2000) dominantEra = '90s Kid';
                else if (avgYear < 2010) dominantEra = '2000s / Millennial';
                else dominantEra = 'Modern / Gen Z';
            }

            // 4. Get Audio Features
        const features = trackIds.length ? await getAudioFeatures(trackIds) : [];
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
    } catch (error) {
        console.error('Metadata processing failed', error);
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
                    'Cache-Control': `public, max-age=${SUMMARY_CACHE_TTL_SECONDS}`,
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
    let attempts = 0;
    let transientFailures = 0;

    for (const model of SUMMARY_MODEL_PRIORITY) {
        if (attempts >= SUMMARY_MAX_MODEL_ATTEMPTS || transientFailures >= SUMMARY_MAX_TRANSIENT_FAILURES) {
            break;
        }

        attempts += 1;
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

        // If rate limited, payload too large, or server error, try next model
        if (response.status === 429 || response.status === 413 || response.status >= 500) {
            transientFailures += 1;
            console.warn(`Model ${model} failed with ${response.status}, trying next...`);
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
        error: `Summary models unavailable after ${attempts} attempt(s). Try again shortly.`,
    };
}

async function fetchReccoJson(path, searchParams = {}, cacheKeySuffix = '', ttlSeconds = METADATA_CACHE_TTL_SECONDS) {
    const query = new URLSearchParams(
        Object.entries(searchParams)
            .filter(([, value]) => value !== null && value !== undefined && value !== '')
            .map(([key, value]) => [key, String(value)])
    );
    const queryString = query.toString();
    const url = `${RECCOBEATS_BASE_URL}${path}${queryString ? `?${queryString}` : ''}`;
    const cachePath = buildCachePath('recco', path, cacheKeySuffix || queryString || 'none');

    return await getCachedJson(cachePath, ttlSeconds, async () => {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`ReccoBeats request failed (${response.status}) for ${path}`);
            return null;
        }
        return await response.json();
    });
}

async function fetchSpotifyOEmbed(spotifyUrl) {
    if (!spotifyUrl) return null;
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;
    const cachePath = buildCachePath('oembed', spotifyUrl);

    return await getCachedJson(cachePath, METADATA_CACHE_TTL_SECONDS, async () => {
        const response = await fetch(oembedUrl);
        if (!response.ok) {
            console.warn(`Spotify oEmbed failed (${response.status}) for ${spotifyUrl}`);
            return null;
        }
        return await response.json();
    });
}

function pickBestArtistMatch(candidates, artistName) {
    if (!Array.isArray(candidates) || !candidates.length) return null;
    const normalizedTarget = normalizeForMatch(artistName);
    let best = null;
    let bestScore = -1;

    for (const candidate of candidates) {
        const normalizedCandidate = normalizeForMatch(candidate?.name);
        let score = 0;

        if (normalizedCandidate === normalizedTarget) score += 100;
        if (normalizedCandidate.includes(normalizedTarget)) score += 30;
        if (normalizedTarget.includes(normalizedCandidate)) score += 15;

        if (score > bestScore) {
            best = candidate;
            bestScore = score;
        }
    }

    return best || candidates[0];
}

function pickBestTrackMatch(candidates, trackName, artistName) {
    if (!Array.isArray(candidates) || !candidates.length) return null;

    const targetRaw = normalizeForMatch(trackName);
    const targetClean = normalizeForMatch(cleanTrackNameForMatch(trackName));
    const targetArtist = normalizeForMatch(artistName);
    let best = null;
    let bestScore = -1;

    for (const candidate of candidates) {
        const titleRaw = normalizeForMatch(candidate?.trackTitle);
        const titleClean = normalizeForMatch(cleanTrackNameForMatch(candidate?.trackTitle));
        const artists = Array.isArray(candidate?.artists) ? candidate.artists : [];
        const hasArtistMatch = artists.some(artist => normalizeForMatch(artist?.name) === targetArtist);

        let score = 0;
        if (titleRaw === targetRaw) score += 100;
        if (titleClean === targetClean) score += 80;
        if (titleRaw.includes(targetClean) || targetClean.includes(titleRaw)) score += 25;
        if (titleClean.includes(targetClean) || targetClean.includes(titleClean)) score += 20;
        if (hasArtistMatch) score += 20;
        score += Number(candidate?.popularity || 0) / 10;

        if (score > bestScore) {
            best = candidate;
            bestScore = score;
        }
    }

    return bestScore > 0 ? best : null;
}

async function searchReccoArtist(artistName) {
    const normalized = normalizeForMatch(artistName);
    if (!normalized) return null;

    const data = await fetchReccoJson(
        '/v1/artist/search',
        { searchText: artistName, size: 15 },
        buildCachePath(normalized, 'search'),
        METADATA_CACHE_TTL_SECONDS
    );

    return pickBestArtistMatch(data?.content, artistName);
}

async function getReccoArtistTracks(artistId) {
    if (!artistId) return [];
    const data = await fetchReccoJson(
        `/v1/artist/${artistId}/track`,
        { size: 100 },
        buildCachePath(artistId, 'tracks'),
        METADATA_CACHE_TTL_SECONDS
    );
    return Array.isArray(data?.content) ? data.content : [];
}

async function getReccoTrackAlbumInfo(reccoTrackId) {
    if (!reccoTrackId) return { year: 'unknown', albumName: null };

    const data = await fetchReccoJson(
        `/v1/track/${reccoTrackId}/album`,
        { size: 5 },
        buildCachePath(reccoTrackId, 'album'),
        METADATA_CACHE_TTL_SECONDS
    );
    const albums = Array.isArray(data?.content) ? data.content : [];

    const withYear = albums
        .map(album => ({
            name: album?.title || null,
            year: Number(String(album?.releaseDate || '').slice(0, 4)),
        }))
        .filter(a => Number.isFinite(a.year) && a.year > 1800);

    if (!withYear.length) return { year: 'unknown', albumName: null };

    const earliest = withYear.reduce((a, b) => a.year <= b.year ? a : b);
    return { year: String(earliest.year), albumName: earliest.name };
}

async function getReccoTrackBySpotifyId(spotifyId) {
    if (!spotifyId) return null;
    const data = await fetchReccoJson(
        '/v1/track',
        { ids: spotifyId },
        buildCachePath('track', spotifyId),
        METADATA_CACHE_TTL_SECONDS
    );
    const content = Array.isArray(data?.content) ? data.content : [];
    return content[0] || null;
}

async function findReccoTrackByNameAndArtist(trackName, artistName) {
    const artist = await searchReccoArtist(artistName);
    if (!artist?.id) return null;

    const artistTracks = await getReccoArtistTracks(artist.id);
    if (!artistTracks.length) return null;

    const bestTrack = pickBestTrackMatch(artistTracks, trackName, artistName);
    if (!bestTrack) return null;

    const spotifyId = extractSpotifyIdFromUrl(bestTrack.href);
    if (!spotifyId) return null;

    const { year, albumName } = await getReccoTrackAlbumInfo(bestTrack.id);
    const artistSpotifyUrl = artist.href || bestTrack.artists?.[0]?.href || null;

    return {
        spotifyId,
        reccoTrackId: bestTrack.id,
        year,
        albumName,
        trackHref: bestTrack.href || null,
        artistHref: artistSpotifyUrl,
        trackTitle: bestTrack.trackTitle || trackName,
        artistTitle: artist.name || artistName,
    };
}

async function resolveTrackIds(tracks, chunkSize = 5) {
    const results = [];
    for (let i = 0; i < tracks.length; i += chunkSize) {
        const chunk = tracks.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk.map(track => searchTrackId(track.name, track.artist, track.spotifyUrl)));
        results.push(...chunkResults);
    }
    return results;
}

async function searchTrackId(trackName, artistName, spotifyUrl = null) {
    try {
        const spotifyIdFromInput = extractSpotifyIdFromUrl(spotifyUrl);
        if (spotifyIdFromInput) {
            const reccoTrack = await getReccoTrackBySpotifyId(spotifyIdFromInput);
            if (reccoTrack?.id) {
                const { year } = await getReccoTrackAlbumInfo(reccoTrack.id);
                return {
                    id: spotifyIdFromInput,
                    year,
                    reccoId: reccoTrack.id,
                    href: reccoTrack.href || spotifyUrl,
                };
            }
        }

        const track = await findReccoTrackByNameAndArtist(trackName, artistName);
        if (!track) return null;

        return {
            id: track.spotifyId,
            year: track.year,
            reccoId: track.reccoTrackId,
            href: track.trackHref,
        };
    } catch (error) {
        console.error('Track search error:', error);
        return null;
    }
}

async function getAudioFeatures(trackIds) {
    const uniqueIds = [...new Set(trackIds.filter(Boolean))].slice(0, 100);
    if (!uniqueIds.length) return [];
    return await getReccoBeatsAudioFeatures(uniqueIds);
}

async function getReccoBeatsAudioFeatures(trackIds) {
    const ids = trackIds.slice(0, 100).join(',');
    if (!ids) return [];

    const data = await fetchReccoJson(
        '/v1/audio-features',
        { ids },
        buildCachePath('audio-features', ids),
        METADATA_CACHE_TTL_SECONDS
    );
    const content = Array.isArray(data?.content) ? data.content : [];
    return content
        .map(item => {
            const spotifyId = extractSpotifyIdFromUrl(item?.href);
            if (!spotifyId) return null;

            return {
                id: spotifyId,
                danceability: item?.danceability ?? null,
                energy: item?.energy ?? null,
                valence: item?.valence ?? null,
                acousticness: item?.acousticness ?? null,
                tempo: item?.tempo ?? null,
            };
        })
        .filter(Boolean);
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
    const cacheTtl = method === 'user.getrecenttracks'
        ? LASTFM_NOWPLAYING_CACHE_TTL_SECONDS
        : LASTFM_DEFAULT_CACHE_TTL_SECONDS;

    try {
        const data = await getCachedJson(
            buildCachePath('lastfm', method, user, limit),
            cacheTtl,
            async () => {
                const response = await fetch(lastfmUrl);
                if (!response.ok) {
                    throw new Error(`Last.fm request failed: ${response.status}`);
                }
                return await response.json();
            }
        );

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
                'Cache-Control': `public, max-age=${cacheTtl}, stale-while-revalidate=30`,
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
    const artist = url.searchParams.get('artist');
    const track = url.searchParams.get('track');

    if (!artist && !track) {
        return new Response(
            JSON.stringify({ error: 'Missing artist or track parameter' }),
            { status: 400, headers: corsHeaders }
        );
    }

    const result = await getCachedJson(
        buildCachePath('spotify-proxy', artist || 'none', track || 'none'),
        180,
        async () => {
            if (track && artist) {
                return await searchTrack(track, artist);
            }
            return await searchArtist(artist);
        }
    );

    return new Response(JSON.stringify(result || { albumImage: null, artistImage: null }), {
        headers: {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=180, stale-while-revalidate=120',
        }
    });
}

async function searchArtist(artistName) {
    try {
        const artist = await searchReccoArtist(artistName);
        if (!artist?.id) return { artistImage: null };

        const spotifyUrl = artist.href || null;
        const embed = spotifyUrl ? await fetchSpotifyOEmbed(spotifyUrl) : null;
        return {
            artistImage: embed?.thumbnail_url || null,
            artistName: artist.name || artistName,
            spotifyUrl,
            reccoArtistId: artist.id,
        };
    } catch (error) {
        console.error('Artist search error:', error);
        return { artistImage: null };
    }
}

async function searchTrack(trackName, artistName) {
    try {
        const track = await findReccoTrackByNameAndArtist(trackName, artistName);
        if (!track) {
            const artistResult = await searchArtist(artistName);
            return { albumImage: null, artistImage: artistResult.artistImage };
        }

        const [trackEmbed, artistEmbed] = await Promise.all([
            track.trackHref ? fetchSpotifyOEmbed(track.trackHref) : Promise.resolve(null),
            track.artistHref ? fetchSpotifyOEmbed(track.artistHref) : Promise.resolve(null),
        ]);

        return {
            albumImage: trackEmbed?.thumbnail_url || null,
            artistImage: artistEmbed?.thumbnail_url || null,
            spotifyUrl: track.trackHref || null,
            spotifyId: track.spotifyId || null,
            trackName: track.trackTitle || trackName,
            artistName: track.artistTitle || artistName,
            albumName: track.albumName || null,
        };
    } catch (error) {
        console.error('Track search error:', error);
        return { albumImage: null, artistImage: null };
    }
}

