/**
 * Spotify Proxy Worker
 * 
 * Securely handles Spotify API authentication server-side.
 * Frontend calls this worker to get artist/track images without exposing credentials.
 * 
 * 
 * Endpoints:
 * - GET /?artist=<name> → { artistImage: "url" }
 * - GET /?track=<name>&artist=<name> → { albumImage: "url", artistImage: "url" }
 */

// In-memory token cache (persists across requests within same isolate)
let cachedToken = null;
let tokenExpiry = 0;

export default {
    async fetch(request, env) {
        // CORS headers for cross-origin requests
        const corsHeaders = {
            'Access-Control-Allow-Origin': 'https://*.glenmuthoka.com', 
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': 'application/json',
        };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            const url = new URL(request.url);
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

        } catch (error) {
            console.error('Worker error:', error);
            return new Response(
                JSON.stringify({ error: 'Internal server error' }),
                { status: 500, headers: corsHeaders }
            );
        }
    }
};

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
