/**
 * Music Page - Multi-Source Now Playing
 * Supports: Last.fm, Spotify (for metadata enrichment), Apple Music (future)
 * 
 * API keys are injected via Jekyll from environment variables.
 * For local development, set the keys in _config.yml
 * For production, use GitHub Actions secrets.
 */

// ==========================================
// Configuration 
// ==========================================
const CONFIG = {
    lastfm: {
        enabled: true,
        apiKey: window.MUSIC_CONFIG?.lastfm?.apiKey || '',
        username: window.MUSIC_CONFIG?.lastfm?.username || 'glenfire',
        pollInterval: 10000,
    },
    spotify: {
        enabled: window.MUSIC_CONFIG?.spotify?.enabled ?? true,
        workerUrl: window.MUSIC_CONFIG?.spotify?.workerUrl || '',
    },
    aiSummary: {
        enabled: window.MUSIC_CONFIG?.aiSummary?.enabled ?? true,
        workerUrl: window.MUSIC_CONFIG?.aiSummary?.workerUrl || window.MUSIC_CONFIG?.spotify?.workerUrl || '',
        activeLimit: 20, // Increased to capture the "sprinkle" history
        sessionLimit: 25,
        sessionGapMinutes: 90,
    },
    maxRecentTracks: 8, // Increased for desktop view
};

class LRUCache {
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return undefined;
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    has(key) {
        return this.cache.has(key);
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        this.cache.set(key, value);
        if (this.cache.size > this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
    }
}

const spotifyRequestLimiter = {
    maxConcurrent: 3,
    active: 0,
    queue: [],
};

function limitedFetch(url, options) {
    return new Promise((resolve, reject) => {
        const run = () => {
            spotifyRequestLimiter.active += 1;
            fetch(url, options).then(resolve, reject).finally(() => {
                spotifyRequestLimiter.active -= 1;
                const next = spotifyRequestLimiter.queue.shift();
                if (next) next();
            });
        };

        if (spotifyRequestLimiter.active < spotifyRequestLimiter.maxConcurrent) {
            run();
        } else {
            spotifyRequestLimiter.queue.push(run);
        }
    });
}

// ==========================================
// State Management
// ==========================================
const state = {
    currentTrack: null,
    activeSource: null,
    isLoading: true,
    sources: {
        lastfm: { connected: false, playing: false, track: null },
        spotify: { connected: false, playing: false, track: null },
    },
    recentTracks: [],
    artistCache: new LRUCache(50), // Cache artist images
    trackCache: new LRUCache(100), // Cache album/artist art by track+artist key
    pendingTrackRequests: new Map(),
    currentColors: null, // Extracted colors from current track
    aiSummary: {
        lastSignature: '',
        lastUpdated: 0,
        isLoading: false,
    },
};

let hasLoadedOnce = false;

// ==========================================
// DOM Elements
// ==========================================
const elements = {
    card: document.getElementById('now-playing-card'),
    albumArt: document.getElementById('album-art'),
    artistBackdrop: document.getElementById('artist-backdrop'),
    artistThumbnail: document.getElementById('artist-thumbnail'),
    artistThumbnailContainer: document.getElementById('artist-thumbnail-container'),
    trackName: document.getElementById('track-name'),
    artistName: document.getElementById('artist-name'),
    albumName: document.getElementById('album-name'),
    listeningStatus: document.getElementById('listening-status'),
    playingIndicator: document.getElementById('playing-indicator'),
    recentTracksList: document.getElementById('recent-tracks-list'),
    musicHero: document.querySelector('.music-hero'),
    indicators: {
        lastfm: document.getElementById('lastfm-indicator'),
        spotify: document.getElementById('spotify-indicator'),
    },
    immersiveBg: document.getElementById('immersive-bg'),
    headerBox: document.querySelector('.header-center-box'),
    recentTracksCard: document.querySelector('.recent-tracks'),
    recentBackdrop: document.getElementById('recent-backdrop'),
    aiSummaryCard: document.getElementById('ai-summary-card'),
    aiBackdrop: document.getElementById('ai-backdrop'),
    aiSummaryText: document.getElementById('ai-summary-text'),
    aiSummaryLoading: document.getElementById('ai-summary-loading'),
};

async function readJsonSafely(response, label) {
    const text = await response.text();

    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        console.warn(`${label} JSON parse failed:`, error);
        return null;
    }
}

// ==========================================
// Spotify API (via Cloudflare Worker Proxy)
// ==========================================
async function getSpotifyArtistImage(artistName) {
    // Check cache first
    if (state.artistCache.has(artistName)) {
        return state.artistCache.get(artistName);
    }

    if (!CONFIG.spotify.workerUrl) {
        return null;
    }

    try {
        const response = await limitedFetch(
            `${CONFIG.spotify.workerUrl}?type=spotify&artist=${encodeURIComponent(artistName)}`
        );

        if (!response.ok) throw new Error('Worker request failed');

        const data = await readJsonSafely(response, 'Spotify artist');
        if (!data) {
            state.sources.spotify.connected = false;
            return null;
        }
        state.sources.spotify.connected = true;

        if (data.artistImage) {
            state.artistCache.set(artistName, data.artistImage);
            return data.artistImage;
        }

        state.artistCache.set(artistName, null);
        return null;
    } catch (error) {
        console.warn('Spotify artist fetch failed:', error);
        state.sources.spotify.connected = false;
        return null;
    }
}

async function getSpotifyTrackData(trackName, artistName) {
    if (!CONFIG.spotify.workerUrl) {
        return null;
    }

    const trackKey = getTrackCacheKey(trackName, artistName);
    if (state.trackCache.has(trackKey)) {
        return state.trackCache.get(trackKey);
    }

    if (state.pendingTrackRequests.has(trackKey)) {
        return state.pendingTrackRequests.get(trackKey);
    }

    const requestPromise = (async () => {
        try {
            const response = await limitedFetch(
                `${CONFIG.spotify.workerUrl}?type=spotify&track=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artistName)}`
            );

            if (!response.ok) throw new Error('Worker request failed');

            const data = await readJsonSafely(response, 'Spotify track');
            if (!data) {
                state.sources.spotify.connected = false;
                return null;
            }
            state.sources.spotify.connected = true;

            return {
                albumImage: data.albumImage || null,
                artistImage: data.artistImage || null,
                spotifyUrl: data.spotifyUrl || null,
            };
        } catch (error) {
            console.warn('Spotify track fetch failed:', error);
            state.sources.spotify.connected = false;
            return null;
        }
    })();

    state.pendingTrackRequests.set(trackKey, requestPromise);
    try {
        return await requestPromise;
    } finally {
        state.pendingTrackRequests.delete(trackKey);
    }
}

// ==========================================
// Last.fm Integration
// ==========================================
async function fetchLastFmNowPlaying() {
    // Use worker if available, otherwise fall back to direct (for local dev)
    const workerUrl = CONFIG.spotify.workerUrl; // Unified worker handles both

    if (!CONFIG.lastfm.enabled) {
        return null;
    }

    let url;
    if (workerUrl) {
        // Use secure worker proxy (production)
        url = `${workerUrl}?type=lastfm&user=${CONFIG.lastfm.username}&method=user.getrecenttracks&limit=${CONFIG.maxRecentTracks + 1}`;
    } else if (CONFIG.lastfm.apiKey) {
        // Direct API call (local development only)
        url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${CONFIG.lastfm.username}&api_key=${CONFIG.lastfm.apiKey}&format=json&limit=${CONFIG.maxRecentTracks + 1}`;
    } else {
        state.sources.lastfm.connected = false;
        return null;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Last.fm API error');

        const data = await readJsonSafely(response, 'Last.fm');
        if (!data) {
            state.sources.lastfm.connected = false;
            return null;
        }
        const tracks = data.recenttracks?.track;

        if (!tracks || tracks.length === 0) {
            state.sources.lastfm.connected = true;
            state.sources.lastfm.playing = false;
            return null;
        }

        state.sources.lastfm.connected = true;

        const nowPlaying = tracks[0];
        const isPlaying = nowPlaying['@attr']?.nowplaying === 'true';

        // Get basic track info from Last.fm
        const trackInfo = {
            name: nowPlaying.name,
            artist: nowPlaying.artist['#text'] || nowPlaying.artist.name,
            album: nowPlaying.album['#text'],
            image: getLastFmImage(nowPlaying.image),
            artistImage: null,
            url: nowPlaying.url,
            source: 'lastfm',
        };
        const trackKey = getTrackCacheKey(trackInfo.name, trackInfo.artist);

        // Check cache immediately for Spotify enrichment
        if (state.trackCache.has(trackKey)) {
            const cached = state.trackCache.get(trackKey);
            trackInfo.image = cached.albumImage || trackInfo.image;
            trackInfo.artistImage = cached.artistImage;
            trackInfo.spotifyUrl = cached.spotifyUrl;
        }

        const isSameTrack = state.sources.lastfm.track && state.sources.lastfm.track.name === trackInfo.name;

        // PRESERVE EXISTING IMAGE if track hasn't changed
        // This prevents the "flash" of low-res Last.fm image overwriting the high-res Spotify image
        if (isSameTrack && state.sources.lastfm.track.image) {
            trackInfo.image = state.sources.lastfm.track.image;
            trackInfo.artistImage = state.sources.lastfm.track.artistImage;
            trackInfo.spotifyUrl = state.sources.lastfm.track.spotifyUrl;

            // FIX: If colors are missing (e.g. first load failed), retry extraction
            if (!state.currentColors && trackInfo.image) {
                extractColors(trackInfo.image).then(colors => {
                    if (colors) applyDynamicColors(colors);
                });
            }

            // Still fetch in background to check for updates (silent)
            if (CONFIG.spotify.enabled) {
                getSpotifyTrackData(trackInfo.name, trackInfo.artist).then(spotifyData => {
                    if (!spotifyData) return;
                    if (spotifyData.albumImage || spotifyData.artistImage || spotifyData.spotifyUrl) {
                        state.trackCache.set(trackKey, {
                            albumImage: spotifyData.albumImage || trackInfo.image || null,
                            artistImage: spotifyData.artistImage || null,
                            spotifyUrl: spotifyData.spotifyUrl || null,
                        });
                        trackInfo.spotifyUrl = spotifyData.spotifyUrl;
                    }
                    if (spotifyData.artistImage && !trackInfo.artistImage) {
                        state.sources.lastfm.track.artistImage = spotifyData.artistImage;
                        if (state.activeSource === 'lastfm') updateNowPlayingCard(state.sources.lastfm.track, true);
                    }
                }).catch(() => { });
            }
        }
        // NEW TRACK: Try to get Spotify image (Priority) but don't block forever
        else if (CONFIG.spotify.enabled) {
            const spotifyPromise = getSpotifyTrackData(trackInfo.name, trackInfo.artist);
            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 800)); // 800ms grace period

            try {
                // Wait briefly for Spotify (prioritize quality)
                const spotifyData = await Promise.race([spotifyPromise, timeoutPromise]);

                if (spotifyData) {
                    // Success! Use Spotify data immediately
                    if (spotifyData.albumImage) trackInfo.image = spotifyData.albumImage;
                    trackInfo.artistImage = spotifyData.artistImage;
                    trackInfo.spotifyUrl = spotifyData.spotifyUrl;
                    
                    if (spotifyData.albumImage || spotifyData.artistImage || spotifyData.spotifyUrl) {
                        state.trackCache.set(trackKey, {
                            albumImage: spotifyData.albumImage || trackInfo.image || null,
                            artistImage: spotifyData.artistImage || null,
                            spotifyUrl: spotifyData.spotifyUrl || null,
                        });
                    }
                } else {
                    // Timeout - Render Last.fm data first, then update when Spotify arrives
                    spotifyPromise.then(delayedData => {
                        if (delayedData) {
                            if (state.sources.lastfm.playing &&
                                state.sources.lastfm.track &&
                                state.sources.lastfm.track.name === trackInfo.name) {

                                if (delayedData.albumImage) state.sources.lastfm.track.image = delayedData.albumImage;
                                state.sources.lastfm.track.artistImage = delayedData.artistImage;
                                state.sources.lastfm.track.spotifyUrl = delayedData.spotifyUrl;

                                if (delayedData.albumImage || delayedData.artistImage || delayedData.spotifyUrl) {
                                    state.trackCache.set(trackKey, {
                                        albumImage: delayedData.albumImage || state.sources.lastfm.track.image || null,
                                        artistImage: delayedData.artistImage || null,
                                        spotifyUrl: delayedData.spotifyUrl || null,
                                    });
                                }

                                // Re-extract colors for the new high-res image
                                if (delayedData.albumImage) {
                                    extractColors(delayedData.albumImage).then(colors => {
                                        if (colors) applyDynamicColors(colors);
                                    });
                                }

                                if (state.activeSource === 'lastfm') {
                                    updateNowPlayingCard(state.sources.lastfm.track, true);
                                    updateSourceIndicators();
                                }
                            }
                        }
                    }).catch(console.warn);
                }
            } catch (e) {
                console.warn('Spotify fetch error', e);
            }
        }

        if (isPlaying) {
            state.sources.lastfm.playing = true;
            state.sources.lastfm.track = trackInfo;

            state.recentTracks = tracks.slice(1, CONFIG.maxRecentTracks + 1).map(track => {
                const name = track.name;
                const artist = track.artist['#text'] || track.artist.name;
                const key = getTrackCacheKey(name, artist);
                const cached = state.trackCache.get(key);
                return {
                    name,
                    artist,
                    image: cached?.albumImage || getLastFmImage(track.image, 'large'),
                    artistImage: cached?.artistImage || null,
                    spotifyUrl: cached?.spotifyUrl || null,
                    date: track.date?.uts ? new Date(track.date.uts * 1000) : null,
                    enriched: !!cached,
                };
            });

            return state.sources.lastfm.track;
        } else {
            state.sources.lastfm.playing = false;

            state.recentTracks = tracks.slice(0, CONFIG.maxRecentTracks).map(track => {
                const name = track.name;
                const artist = track.artist['#text'] || track.artist.name;
                const key = getTrackCacheKey(name, artist);
                const cached = state.trackCache.get(key);
                return {
                    name,
                    artist,
                    image: cached?.albumImage || getLastFmImage(track.image, 'large'),
                    artistImage: cached?.artistImage || null,
                    spotifyUrl: cached?.spotifyUrl || null,
                    date: track.date?.uts ? new Date(track.date.uts * 1000) : null,
                    enriched: !!cached,
                };
            });

            return null;
        }
    } catch (error) {
        console.error('Last.fm fetch error:', error);
        state.sources.lastfm.connected = false;
        return null;
    }
}

function getLastFmImage(images, size = 'extralarge') {
    if (!images || !Array.isArray(images)) return null;

    const sizeMap = { small: 0, medium: 1, large: 2, extralarge: 3, mega: 4 };
    const index = sizeMap[size] ?? 3;

    for (let i = index; i >= 0; i--) {
        if (images[i]?.['#text']) {
            return images[i]['#text'];
        }
    }
    return null;
}

function getTrackCacheKey(name, artist) {
    return `${(name || '').toLowerCase()}||${(artist || '').toLowerCase()}`;
}

// ==========================================
// AI Summary
// ==========================================
const AI_ERROR_MESSAGES = [
    "seems like glen forgot to pay the electricity bills",
    "seems like glen's wifi stopped working",
    "seems like glen has annoyed the robots and they said NO",
    "the ai is currently on strike for better virtual cookies",
    "glen's musical brain is currently in 'do not disturb' mode",
    "the robots are judging glen's taste and need a minute",
    "glen's scrobble history is too powerful for the servers right now",
    "glen's playlist is so fire the ai had to take a cooling break",
    "the algorithm is busy dancing to glen's last scrobble",
    "ai is searching for glen's taste in the deep cloud",
    "seems like the ai is lost in glen's sonic landscape",
    "glen's music taste is so eclectic the robots are confused",
    "the robots are currently debating if glen's taste is 'cool' or 'too cool'",
    "glen's music journey is currently off-the-grid",
    "the ai is waiting for glen to drop the bass",
    "seems like the server is vibing too hard to glen's tracks",
    "glen's scrobbles are currently traveling through a wormhole",
    "the ai is practicing its dance moves for glen's next session",
    "glen's taste is so unique the ai is writing a thesis on it",
    "the robots are busy scrobbling their own synthesized beats"
];

function getRandomAiError() {
    return AI_ERROR_MESSAGES[Math.floor(Math.random() * AI_ERROR_MESSAGES.length)];
}

function setAiSummaryLoading(isLoading) {
    if (!elements.aiSummaryCard || !elements.aiSummaryLoading) return;
    elements.aiSummaryCard.classList.toggle('is-loading', isLoading);
    elements.aiSummaryLoading.textContent = isLoading ? 'Reading Glen\'s musical mind...' : '';
}

function resetAiSummaryText() {
    if (!elements.aiSummaryText) return;
    elements.aiSummaryText.textContent = '';
}

function setAiSummaryMessage(text) {
    if (!elements.aiSummaryText || !elements.aiSummaryCard) return;
    elements.aiSummaryText.textContent = text;
    elements.aiSummaryCard.classList.remove('is-loading');
}

function appendAiSummaryChunk(text) {
    if (!elements.aiSummaryText || !text) return;
    const fragment = document.createDocumentFragment();
    const chars = Array.from(text);
    chars.forEach((char, index) => {
        const span = document.createElement('span');
        span.className = 'ai-char';
        span.textContent = char;
        span.style.animationDelay = `${index * 8}ms`;
        fragment.appendChild(span);
    });
    elements.aiSummaryText.appendChild(fragment);
}

function normalizeAiSummary(text) {
    if (!text) return '';
    let cleaned = String(text).replace(/\s+/g, ' ').trim();

    cleaned = cleaned.replace(/^session recap\s*ai\s*/i, '').trim();
    const firstSentence = cleaned.match(/[^.!?]+[.!?]/);
    if (firstSentence) {
        cleaned = firstSentence[0].trim();
    }

    const words = cleaned.split(' ').filter(Boolean).slice(0, 24);
    cleaned = words.join(' ');
    return cleaned.toLowerCase();
}

function rebuildAiSummaryText(text) {
    if (!elements.aiSummaryText) return;
    elements.aiSummaryText.textContent = '';
    appendAiSummaryChunk(text);
}

async function fetchLastFmRecentTracks(limit) {
    const workerUrl = CONFIG.spotify.workerUrl;

    if (!CONFIG.lastfm.enabled) {
        return [];
    }

    let url;
    if (workerUrl) {
        url = `${workerUrl}?type=lastfm&user=${CONFIG.lastfm.username}&method=user.getrecenttracks&limit=${limit}&_cb=${Date.now()}`;
    } else if (CONFIG.lastfm.apiKey) {
        url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${CONFIG.lastfm.username}&api_key=${CONFIG.lastfm.apiKey}&format=json&limit=${limit}&_cb=${Date.now()}`;
    } else {
        return [];
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Last.fm API error');

        const data = await readJsonSafely(response, 'Last.fm summary');
        const tracks = data?.recenttracks?.track || [];
        return Array.isArray(tracks) ? tracks : [];
    } catch (error) {
        console.warn('Summary track fetch failed:', error);
        return [];
    }
}

function selectActiveTracks(tracks) {
    const filtered = tracks.filter(track => track?.['@attr']?.nowplaying !== 'true');
    return filtered.slice(0, CONFIG.aiSummary.activeLimit);
}

function selectSessionTracks(tracks) {
    const session = [];
    let lastUts = null;
    const gapSeconds = CONFIG.aiSummary.sessionGapMinutes * 60;

    for (const track of tracks) {
        if (track?.['@attr']?.nowplaying === 'true') {
            continue;
        }

        const uts = track?.date?.uts ? Number(track.date.uts) : null;
        if (!uts) {
            continue;
        }

        if (lastUts && (lastUts - uts) > gapSeconds) {
            break;
        }

        session.push(track);
        lastUts = uts;

        if (session.length >= CONFIG.aiSummary.sessionLimit) {
            break;
        }
    }

    return session;
}

function formatTracksForSummary(tracks) {
    const artistCounts = {};
    
    tracks.forEach(track => {
        const artist = track.artist?.['#text'] || track.artist?.name || 'Unknown';
        artistCounts[artist] = (artistCounts[artist] || 0) + 1;
    });

    return tracks.map((track, index) => {
        const artist = track.artist?.['#text'] || track.artist?.name || 'Unknown';
        const isNowPlaying = track?.['@attr']?.nowplaying === 'true';

        // Stricter Tiers to prevent LLM "artist anchor" bias:
        // 0-3: Core Narrative (The current vibe)
        // 4-7: Transitional (How we got here)
        // 8-19: Echoes (Pure background context, do NOT anchor summary on these)
        let focus, weight, ignoreReason = null;
        if (index < 4) {
            focus = "CURRENT_ESSENTIAL";
            weight = 1.0;
        } else if (index < 8) {
            focus = "RECENT_CONTEXT";
            weight = 0.5;
        } else {
            focus = "DISTANT_ECHO";
            weight = 0.05; // Drop weighting almost to zero
            // If an artist only appears in this tier, they shouldn't be the summary title/hook
            if (artistCounts[artist] < 3) ignoreReason = "low_frequency_historical";
        }

        return {
            name: track.name || 'Unknown',
            artist: artist,
            importance: focus,
            relevance_score: weight,
            hint: ignoreReason ? "Minor historical data" : focus.replace(/_/g, ' '),
            is_active: isNowPlaying
        };
    }).filter(track => track.name && track.artist);
}

async function streamAiSummary(tracks, mode) {
    if (!CONFIG.aiSummary.workerUrl) {
        setAiSummaryMessage(getRandomAiError());
        return;
    }

    // Force a fresh take by sending a dynamic token and explicit personality instructions
    const response = await fetch(`${CONFIG.aiSummary.workerUrl}?type=summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode,
            tracks,
            trackCount: tracks.length,
            // Anti-repetition seed
            request_id: `vibe_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            // Explicit instructions for the LLM weighting tiers
            weighting: {
                hero_indices: [0, 1, 2, 3],
                background_indices: [8, 9, 10, 11, 12, 13, 14, 15]
            },
            options: {
                temperature: 0.9, // Higher for more creative diversity
                top_p: 0.95,
                frequency_penalty: 1.2, // Discourage repeating the same hooks/artists
                presence_penalty: 1.0
            }
        }),
    });

    if (!response.ok) {
        throw new Error(`Summary request failed: ${response.status}`);
    }

    if (!response.body) {
        const data = await readJsonSafely(response, 'AI summary');
        if (data?.summary) {
            const normalized = normalizeAiSummary(data.summary);
            rebuildAiSummaryText(normalized || data.summary);
        }
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = line.replace(/^data:\s*/, '').trim();
            if (!payload || payload === '[DONE]') continue;

            try {
                const json = JSON.parse(payload);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                    fullText += delta;
                    appendAiSummaryChunk(delta);
                }
            } catch (error) {
                console.warn('AI stream parse failed:', error);
            }
        }
    }

    const normalized = normalizeAiSummary(fullText);
    if (normalized && normalized !== fullText.trim()) {
        rebuildAiSummaryText(normalized);
    }
}

async function updateAiSummary() {
    if (!elements.aiSummaryCard || !CONFIG.aiSummary.enabled) return;
    if (state.aiSummary.isLoading) return;
    if (!CONFIG.aiSummary.workerUrl) {
        setAiSummaryMessage(getRandomAiError());
        return;
    }

    const isPlaying = state.sources.lastfm.playing;
    const trackLimit = isPlaying
        ? CONFIG.aiSummary.activeLimit + 1
        : CONFIG.aiSummary.sessionLimit;

    const recentTracks = await fetchLastFmRecentTracks(trackLimit);
    if (!recentTracks.length) {
        setAiSummaryMessage("Glen's music history is a clean slate.");
        return;
    }

    const selectedTracks = isPlaying
        ? selectActiveTracks(recentTracks)
        : selectSessionTracks(recentTracks);

    if (!selectedTracks.length) {
        setAiSummaryMessage("Waiting for Glen to press play on a new session.");
        return;
    }

    const formattedTracks = formatTracksForSummary(selectedTracks);
    const signature = `${isPlaying ? 'active' : 'session'}|${formattedTracks.map(track => `${track.name}|${track.artist}`).join('||')}`;

    // Cooldown: Don't refresh more than once every 45 seconds even if tracks change
    // This prevents hitting the LLM too hard during rapid track skipping
    const now = Date.now();
    const cooldownMs = 45000;
    const isCooldownActive = (now - state.aiSummary.lastUpdated) < cooldownMs;

    if (signature === state.aiSummary.lastSignature || isCooldownActive) {
        return;
    }

    state.aiSummary.lastSignature = signature;
    state.aiSummary.lastUpdated = now;
    state.aiSummary.isLoading = true;
    resetAiSummaryText();
    setAiSummaryLoading(true);

    try {
        const chronologicalTracks = [...formattedTracks].reverse();
        await streamAiSummary(chronologicalTracks, isPlaying ? 'active' : 'session');
    } catch (error) {
        console.warn('AI summary failed:', error);
        setAiSummaryMessage(getRandomAiError());
    } finally {
        state.aiSummary.isLoading = false;
        setAiSummaryLoading(false);
    }
}



// ==========================================
// UI Updates
// ==========================================
function updateUI() {
    let activeTrack = null;
    let activeSource = null;

    // Priority: Spotify > Apple > Last.fm (but Last.fm is the primary scrobbler)
    if (state.sources.spotify.playing && state.sources.spotify.track) {
        activeTrack = state.sources.spotify.track;
        activeSource = 'spotify';

    } else if (state.sources.lastfm.playing && state.sources.lastfm.track) {
        activeTrack = state.sources.lastfm.track;
        activeSource = 'lastfm';
    }

    state.activeSource = activeSource;

    updateSourceIndicators();
    updateNowPlayingCard(activeTrack, !!activeTrack);
    updateRecentTracks();
    updateAiSummary();

    const hasAnyData = !!(
        state.sources.lastfm.connected ||
        state.sources.spotify.connected ||
        state.sources.lastfm.track ||
        state.sources.spotify.track ||
        state.recentTracks.length
    );

    if (hasAnyData && !hasLoadedOnce) {
        setLoadingState(false);
        hasLoadedOnce = true;
    }
}

function updateSourceIndicators() {
    Object.keys(elements.indicators).forEach(source => {
        const indicator = elements.indicators[source];
        if (!indicator) return;

        const sourceState = state.sources[source];

        indicator.classList.remove('active', 'connected');

        // For Last.fm: mark as 'active' if it's the active source OR if playing
        // For Spotify: mark as 'connected' when we have credentials (used for enrichment)
        if (source === 'lastfm') {
            if (state.activeSource === 'lastfm' || sourceState.playing) {
                indicator.classList.add('active');
            } else if (sourceState.connected) {
                indicator.classList.add('connected');
            }
        } else if (source === 'spotify') {
            // Spotify is 'active' if it provided the current track image/enrichment
            // Spotify is 'connected' if we have successfully contacted the worker
            if (state.sources.lastfm.track && state.sources.lastfm.track.artistImage && state.sources.spotify.connected) {
                indicator.classList.add('active');
            } else if (state.sources.spotify.connected) {
                indicator.classList.add('connected');
            }
        } else {
            // Default behavior for other sources
            if (sourceState.playing) {
                indicator.classList.add('active');
            } else if (sourceState.connected) {
                indicator.classList.add('connected');
            }
        }
    });
}

function updateBackdrops(imageUrl) {
    const backdrops = [elements.artistBackdrop, elements.recentBackdrop, elements.aiBackdrop, elements.immersiveBg];
    backdrops.forEach(bg => {
        if (!bg) return;
        if (imageUrl) {
            setBackgroundIfChanged(bg, imageUrl);
            bg.classList.add('loaded');
        } else {
            setBackgroundIfChanged(bg, '');
            bg.classList.remove('loaded');
        }
    });
}


function updateNowPlayingCard(track, isPlaying) {
    if (state.isLoading && !track && state.recentTracks.length === 0) {
        return;
    }

    if (track) {
        elements.trackName.textContent = track.name;
        elements.artistName.textContent = track.artist;
        elements.albumName.textContent = track.album || '';

        // Add clickable link to the card
        const songLink = getSongLink(track);
        if (elements.card) {
            elements.card.style.cursor = 'pointer';
            elements.card.onclick = () => window.open(songLink, '_blank', 'noopener,noreferrer');
            elements.card.title = `Click to open ${track.name} on your music app`;
        }

        // Album art
        if (track.image) {
            setImageIfChanged(elements.albumArt, track.image, () => {
                elements.albumArt.classList.add('loaded');
            }, () => {
                elements.albumArt.classList.remove('loaded');
            });
        } else {
            setImageIfChanged(elements.albumArt, '');
            elements.albumArt.classList.remove('loaded');
        }

        // Artist image (thumbnail and shared backdrops)
        if (track.artistImage) {
            const changed = setImageIfChanged(elements.artistThumbnail, track.artistImage, () => {
                elements.artistThumbnailContainer.classList.add('loaded');
            });
            // If the image URL didn't change, ensure the loaded class is still present
            if (!changed) {
                elements.artistThumbnailContainer.classList.add('loaded');
            }
            updateBackdrops(track.artistImage);
        } else {
            elements.artistThumbnailContainer.classList.remove('loaded');
            updateBackdrops('');
        }

        elements.playingIndicator.classList.add('active');
        elements.listeningStatus.textContent = 'Now Playing';
        elements.listeningStatus.classList.add('now-playing');

        // Extract colors from album art for dynamic theming
        if (track.image) {
            extractColors(track.image).then(colors => {
                if (colors) {
                    applyDynamicColors(colors);
                }
            });
        }
    } else {
        elements.playingIndicator.classList.remove('active');

        if (state.recentTracks.length > 0) {
            const lastTrack = state.recentTracks[0];
            elements.trackName.textContent = lastTrack.name;
            elements.artistName.textContent = lastTrack.artist;
            elements.albumName.textContent = '';

            // Add clickable link for last played track
            const songLink = getSongLink(lastTrack);
            if (elements.card) {
                elements.card.style.cursor = 'pointer';
                elements.card.onclick = () => window.open(songLink, '_blank', 'noopener,noreferrer');
                elements.card.title = `Click to open ${lastTrack.name} on your music app`;
            }

            if (lastTrack.image) {
                setImageIfChanged(elements.albumArt, lastTrack.image, () => {
                    elements.albumArt.classList.add('loaded');
                });
            } else {
                setImageIfChanged(elements.albumArt, '', () => {
                    elements.albumArt.classList.remove('loaded');
                }, () => {
                    elements.albumArt.classList.remove('loaded');
                });
            }

            if (lastTrack.artistImage) {
                const changed = setImageIfChanged(elements.artistThumbnail, lastTrack.artistImage, () => {
                    elements.artistThumbnailContainer.classList.add('loaded');
                });
                if (!changed) {
                    elements.artistThumbnailContainer.classList.add('loaded');
                }
                updateBackdrops(lastTrack.artistImage);
            } else {
                elements.artistThumbnailContainer.classList.remove('loaded');
                updateBackdrops('');
            }

            const timeAgo = lastTrack.date ? getTimeAgo(lastTrack.date) : 'recently';
            elements.listeningStatus.textContent = `Last played ${timeAgo}`;

            // ENRICHMENT: Fetch high-res art/artist image for the last played track too
            const recentKey = getTrackCacheKey(lastTrack.name, lastTrack.artist);
            if (CONFIG.spotify.enabled && !state.trackCache.has(recentKey)) {
                getSpotifyTrackData(lastTrack.name, lastTrack.artist).then(spotifyData => {
                    if (!spotifyData) return;

                    if (spotifyData.albumImage || spotifyData.artistImage || spotifyData.spotifyUrl) {
                        state.trackCache.set(recentKey, {
                            albumImage: spotifyData.albumImage || lastTrack.image || null,
                            artistImage: spotifyData.artistImage || null,
                            spotifyUrl: spotifyData.spotifyUrl || null,
                        });
                    }

                    if (spotifyData.spotifyUrl) {
                        lastTrack.spotifyUrl = spotifyData.spotifyUrl;
                    }

                    if (spotifyData.albumImage) {
                        lastTrack.image = spotifyData.albumImage;
                        setImageIfChanged(elements.albumArt, spotifyData.albumImage, () => {
                            elements.albumArt.classList.add('loaded');
                        });

                        // Also update dynamic colors for high-res image
                        extractColors(spotifyData.albumImage).then(colors => {
                            if (colors) applyDynamicColors(colors);
                        });
                    }

                    if (spotifyData.artistImage) {
                        lastTrack.artistImage = spotifyData.artistImage;
                        const changed = setImageIfChanged(elements.artistThumbnail, spotifyData.artistImage, () => {
                            elements.artistThumbnailContainer.classList.add('loaded');
                        });
                        if (!changed) {
                            elements.artistThumbnailContainer.classList.add('loaded');
                        }
                        updateBackdrops(spotifyData.artistImage);
                    }

                    updateSourceIndicators();
                });
            }
        } else {
            elements.trackName.textContent = 'Glen is taking a break';
            elements.artistName.textContent = '—';
            elements.albumName.textContent = '';
            setImageIfChanged(elements.albumArt, '', () => {
                elements.albumArt.classList.remove('loaded');
            }, () => {
                elements.albumArt.classList.remove('loaded');
            });
            elements.artistThumbnailContainer.classList.remove('loaded');
            elements.artistBackdrop.classList.remove('loaded');
            if (elements.immersiveBg) setBackgroundIfChanged(elements.immersiveBg, '');
            elements.listeningStatus.textContent = 'Silence is golden';

            if (elements.card) {
                elements.card.onclick = null;
                elements.card.style.cursor = 'default';
                elements.card.title = '';
            }
        }
        elements.listeningStatus.classList.remove('now-playing');
    }
}

function updateRecentTracks() {
    if (!elements.recentTracksList) return;

    if (state.isLoading && state.recentTracks.length === 0) {
        return;
    }

    if (!state.activeSource && state.recentTracks.length === 0) {
        if (!elements.musicHero.classList.contains('is-loading')) {
            setLoadingState(true);
        }
        return;
    }

    elements.recentTracksList.innerHTML = '';

    const tracksToShow = state.activeSource ? state.recentTracks : state.recentTracks.slice(1);

    tracksToShow.forEach(track => {
        const li = document.createElement('li');
        const trackLink = getSongLink(track);
        
        li.innerHTML = `
            <a href="${trackLink}" target="_blank" rel="noopener noreferrer" class="track-link">
                <img class="track-thumb" src="${track.image || ''}" alt="" onerror="this.style.display='none'">
                <div class="track-details">
                    <div class="name">${escapeHtml(track.name)}</div>
                    <div class="artist">${escapeHtml(track.artist)}</div>
                </div>
                <span class="track-time">${track.date ? getTimeAgo(track.date) : ''}</span>
            </a>
        `;
        elements.recentTracksList.appendChild(li);
    });
}

// ==========================================
// Color Extraction & Dynamic Theming
// ==========================================
async function extractColors(imageUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const size = 50; // Sample at small size for performance
                canvas.width = size;
                canvas.height = size;

                ctx.drawImage(img, 0, 0, size, size);
                const imageData = ctx.getImageData(0, 0, size, size).data;

                // Extract dominant colors using simple color quantization
                const colors = extractDominantColors(imageData);
                state.currentColors = colors;
                resolve(colors);
            } catch (e) {
                console.warn('Color extraction failed:', e);
                resolve(null);
            }
        };

        img.onerror = () => resolve(null);
        img.src = imageUrl;
    });
}

function extractDominantColors(imageData) {
    const colorCounts = {};
    const colorSamples = [];

    // Sample every 4th pixel (RGBA = 4 values per pixel)
    for (let i = 0; i < imageData.length; i += 16) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const a = imageData[i + 3];

        if (a < 128) continue; // Skip transparent

        // Quantize to reduce color space
        const qr = Math.round(r / 32) * 32;
        const qg = Math.round(g / 32) * 32;
        const qb = Math.round(b / 32) * 32;
        const key = `${qr},${qg},${qb}`;

        if (!colorCounts[key]) {
            colorCounts[key] = { count: 0, r: qr, g: qg, b: qb };
        }
        colorCounts[key].count++;
        colorSamples.push({ r, g, b });
    }

    // Sort by frequency and get top colors
    const sorted = Object.values(colorCounts)
        .filter(c => {
            // Filter out very dark or very light colors
            const brightness = (c.r + c.g + c.b) / 3;
            return brightness > 30 && brightness < 220;
        })
        .sort((a, b) => b.count - a.count);

    // Get primary (most common) and secondary colors
    const primary = sorted[0] || { r: 245, g: 158, b: 11 }; // Fallback to gold
    const secondary = sorted[1] || sorted[0] || { r: 6, g: 182, b: 212 }; // Fallback to cyan
    const accent = sorted[2] || primary;

    // Calculate average brightness for text contrast
    const avgBrightness = colorSamples.reduce((sum, c) => sum + (c.r + c.g + c.b) / 3, 0) / (colorSamples.length || 1);

    return {
        primary: `rgb(${primary.r}, ${primary.g}, ${primary.b})`,
        secondary: `rgb(${secondary.r}, ${secondary.g}, ${secondary.b})`,
        accent: `rgb(${accent.r}, ${accent.g}, ${accent.b})`,
        primaryRaw: primary,
        secondaryRaw: secondary,
        isDark: avgBrightness < 128,
    };
}

function applyDynamicColors(colors) {
    if (!colors || !elements.card) return;

    const { primary, secondary, primaryRaw, secondaryRaw } = colors;

    // Apply to CSS custom properties on the music section
    const root = elements.musicHero || document.documentElement;

    // Create gradient for backdrop using rgba with proper alpha
    const gradientBlur = `
        radial-gradient(ellipse at 30% 20%, rgba(${primaryRaw.r}, ${primaryRaw.g}, ${primaryRaw.b}, 0.4) 0%, transparent 50%),
        radial-gradient(ellipse at 70% 80%, rgba(${secondaryRaw.r}, ${secondaryRaw.g}, ${secondaryRaw.b}, 0.4) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.3) 0%, transparent 70%)
    `;

    // Apply to artist backdrop
    if (elements.artistBackdrop && !elements.artistBackdrop.dataset.bg) {
        elements.artistBackdrop.style.background = gradientBlur;
        elements.artistBackdrop.classList.add('loaded');
    }

    // Apply to Immersive Background (Fallback if no artist image)
    if (elements.immersiveBg && !elements.immersiveBg.style.backgroundImage) {
        elements.immersiveBg.style.background = gradientBlur;
        elements.immersiveBg.classList.add('loaded');
    }

    // Calculate blended color for a richer glow effect
    const blendedR = Math.round((primaryRaw.r + secondaryRaw.r) / 2);
    const blendedG = Math.round((primaryRaw.g + secondaryRaw.g) / 2);
    const blendedB = Math.round((primaryRaw.b + secondaryRaw.b) / 2);

    // Apply accent colors to card with enhanced glow
    const cards = [elements.card, elements.recentTracksCard, elements.aiSummaryCard].filter(Boolean);
    const borderColor = `rgba(${primaryRaw.r}, ${primaryRaw.g}, ${primaryRaw.b}, 0.3)`;
    const glowColor = `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.3)`;

    cards.forEach(card => {
        card.style.setProperty('--dynamic-primary', primary);
        card.style.setProperty('--dynamic-secondary', secondary);
        card.style.setProperty('--dynamic-glow-color', glowColor);
        card.style.setProperty('--dynamic-border-color', borderColor);
        card.style.setProperty('--dynamic-border-color-bright', `rgba(${primaryRaw.r}, ${primaryRaw.g}, ${primaryRaw.b}, 0.6)`);
        card.style.setProperty('--dynamic-scrollbar-color', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.5)`);
        card.style.setProperty('--dynamic-scrollbar-color-bright', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.8)`);
        card.style.borderColor = borderColor;
    });

    // Update playing indicator color
    const indicator = elements.playingIndicator;
    if (indicator) {
        indicator.querySelectorAll('span').forEach(bar => {
            bar.style.background = primary;
        });
    }

    // Update artist name color
    if (elements.artistName) {
        elements.artistName.style.color = primary;
    }

    // Apply to Header (Navbar) with enhanced glow
    if (elements.headerBox) {
        elements.headerBox.style.borderColor = borderColor;
        elements.headerBox.style.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 25px rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.2)`;
        elements.headerBox.style.setProperty('--dynamic-glow-color', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.2)`);
    }

    // Apply to Social Badges & Home Icon (Main Site Elements) with enhanced glow
    const badges = document.querySelectorAll('.social-badge, .static-logo-badge a, .nav-hub .hub-main, .nav-hub .hub-btn');
    badges.forEach(badge => {
        badge.style.setProperty('--dynamic-border-color', borderColor);
        badge.style.setProperty('--dynamic-border-color-bright', `rgba(${primaryRaw.r}, ${primaryRaw.g}, ${primaryRaw.b}, 0.6)`);
        badge.style.setProperty('--dynamic-glow-color', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.25)`);
        badge.style.borderColor = borderColor;
        badge.style.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 15px rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.15)`;
    });

    // Apply to source indicators
    const sourceIndicators = document.querySelectorAll('.source-pill:not(.active)');
    sourceIndicators.forEach(pill => {
        pill.style.setProperty('--dynamic-glow-color', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.15)`);
    });

    // Apply scrollbar colors globally to music hero section
    if (elements.musicHero) {
        elements.musicHero.style.setProperty('--dynamic-scrollbar-color', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.5)`);
        elements.musicHero.style.setProperty('--dynamic-scrollbar-color-bright', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.8)`);
        elements.musicHero.style.setProperty('--dynamic-glow-color', glowColor);
    }
}

function resetDynamicColors() {
    if (!elements.card) return;

    // Reset all cards
    const cards = [elements.card, elements.recentTracksCard, elements.aiSummaryCard].filter(Boolean);
    cards.forEach(card => {
        card.style.removeProperty('--dynamic-primary');
        card.style.removeProperty('--dynamic-secondary');
        card.style.removeProperty('--dynamic-glow-color');
        card.style.removeProperty('--dynamic-border-color');
        card.style.removeProperty('--dynamic-border-color-bright');
        card.style.removeProperty('--dynamic-scrollbar-color');
        card.style.removeProperty('--dynamic-scrollbar-color-bright');
        card.style.borderColor = '';
    });

    if (elements.artistBackdrop) {
        elements.artistBackdrop.style.background = '';
        elements.artistBackdrop.classList.remove('loaded');
    }

    if (elements.playingIndicator) {
        elements.playingIndicator.querySelectorAll('span').forEach(bar => {
            bar.style.background = '';
        });
    }

    if (elements.artistName) {
        elements.artistName.style.color = '';
    }
}

// ==========================================
// Utility Functions
// ==========================================
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getSongLink(track) {
    if (!track || !track.name || !track.artist) return '#';
    
    // 1. If we have the direct Spotify URL, use it via Odesli (Songlink)
    // This provides a multi-platform landing page for the specific track
    if (track.spotifyUrl) {
        return `https://song.link/${track.spotifyUrl}`;
    }

    // 2. Fallback: Search on Spotify directly
    const cleanName = track.name.replace(/\(feat\..*?\)/gi, '').replace(/\[feat\..*?\]/gi, '').trim();
    const query = encodeURIComponent(`${track.artist} ${cleanName}`);
    return `https://open.spotify.com/search/${query}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// ==========================================
// Polling / Main Loop
// ==========================================
async function pollAllSources() {
    await Promise.all([
        fetchLastFmNowPlaying(),
    ]);

    updateUI();
}

function startPolling() {
    pollAllSources();

    const intervals = [];
    if (CONFIG.lastfm.enabled) intervals.push(CONFIG.lastfm.pollInterval);

    const pollInterval = Math.min(...intervals, 10000);
    setInterval(pollAllSources, pollInterval);
}

// ==========================================
// Initialization & Responsive Morphing
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. GPU Optimization: Disable particle effects on music page
    const particleCanvas = document.getElementById('particles');
    if (particleCanvas) {
        particleCanvas.style.display = 'none';
        console.log('Particle system disabled for music page (GPU optimization)');
    }

    const gridBg = document.querySelector('.grid-bg');
    if (gridBg) gridBg.style.opacity = '0';

    // 2. Responsive Morphing Logic
    // Detects layout changes (900px) and applies seamless transition
    initResponsiveMusicMorph();

    // 3. API Key Check & Initial Load
    setLoadingState(true);
    // Allow loading if we have EITHER a direct API key OR a worker URL
    if (!CONFIG.lastfm.apiKey && !CONFIG.spotify.workerUrl) {
        setLoadingState(false);
        elements.listeningStatus.textContent = "Seems like glen didn't pay the API bills";
        setAiSummaryMessage("The robots are on a coffee break until a valid key is provided.");
    } else {
        startPolling();
    }

    // Fade source indicators when scrolling behind the fixed header
    const sourceIndicators = document.querySelector('.source-indicators');
    if (sourceIndicators) {
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            // Start fading at 50px, completely hidden by 120px
            const fadeStart = 50;
            const fadeEnd = 150;

            if (scrollY > fadeStart) {
                const opacity = Math.max(0, 1 - (scrollY - fadeStart) / (fadeEnd - fadeStart));
                sourceIndicators.style.opacity = opacity;
                sourceIndicators.style.pointerEvents = opacity < 0.1 ? 'none' : 'auto';
            } else {
                sourceIndicators.style.opacity = 1;
                sourceIndicators.style.pointerEvents = 'auto';
            }
        }, { passive: true });
    }

    // Log configuration status
    console.log('Music page initialized', {
        lastfm: CONFIG.lastfm.apiKey ? 'configured' : 'missing',
        spotify: CONFIG.spotify.workerUrl ? 'configured' : 'missing (artist images will be unavailable)',
        aiSummary: CONFIG.aiSummary.workerUrl ? 'configured' : 'missing (AI summary disabled)',
    });
});

function initResponsiveMusicMorph() {
    const mql = window.matchMedia('(min-width: 900px)');
    let wasDesktop = mql.matches;

    mql.addEventListener('change', (e) => {
        const isDesktop = e.matches;
        if (isDesktop === wasDesktop) return;
        wasDesktop = isDesktop;

        // Apply morph classes to trigger non-jarring alignment
        const morphElements = [
            elements.card, 
            elements.recentTracksCard, 
            elements.aiSummaryCard
        ].filter(el => el);

        // 1. Set elements to 'setup-morph' to lock them for a frame
        morphElements.forEach(el => el.classList.add('setup-morph'));
        
        // 2. Force reflow
        void document.body.offsetHeight;

        // 3. Remove lock so they smoothly travel to the new CSS-defined positions
        requestAnimationFrame(() => {
            morphElements.forEach(el => el.classList.remove('setup-morph'));
        });
    });
}

function setLoadingState(isLoading) {
    state.isLoading = isLoading;
    if (!elements.musicHero) return;

    elements.musicHero.classList.toggle('is-loading', isLoading);
    if (elements.aiSummaryCard) {
        if (isLoading) {
            resetAiSummaryText();
        }
        setAiSummaryLoading(isLoading);
    }

    if (!isLoading) {
        if (elements.recentTracksList) {
            const items = Array.from(elements.recentTracksList.children);
            const allLoading = items.length > 0 && items.every(item => item.classList.contains('loading-item'));
            if (allLoading) {
                elements.recentTracksList.innerHTML = '';
            }
        }
        return;
    }

    if (isLoading) {
        elements.trackName.textContent = 'Loading...';
        elements.artistName.textContent = 'Connecting to sources';
        elements.albumName.textContent = '';
        elements.listeningStatus.textContent = 'Fetching now playing...';
        elements.listeningStatus.classList.remove('now-playing');
        elements.playingIndicator.classList.remove('active');

        if (elements.recentTracksList) {
            elements.recentTracksList.innerHTML = '';
            for (let i = 0; i < 4; i += 1) {
                const li = document.createElement('li');
                li.className = 'loading-item';
                li.innerHTML = `
                    <div class="track-thumb"></div>
                    <div class="track-details">
                        <div class="name">Loading</div>
                        <div class="artist">Loading</div>
                    </div>
                    <span class="track-time">...</span>
                `;
                elements.recentTracksList.appendChild(li);
            }
        }
    }
}

function setImageIfChanged(imgEl, url, onLoad, onError) {
    if (!imgEl) return false;

    const nextUrl = url || '';
    const currentUrl = imgEl.dataset.src || '';

    if (nextUrl === currentUrl) {
        return false;
    }

    imgEl.dataset.src = nextUrl;

    if (!nextUrl) {
        imgEl.removeAttribute('src');
        if (typeof onError === 'function') {
            onError();
        }
        return true;
    }

    imgEl.onload = typeof onLoad === 'function' ? onLoad : null;
    imgEl.onerror = typeof onError === 'function' ? onError : null;
    imgEl.src = nextUrl;
    return true;
}

function setBackgroundIfChanged(el, url) {
    if (!el) return false;

    const nextUrl = url || '';
    const currentUrl = el.dataset.bg || '';

    if (nextUrl === currentUrl) {
        return false;
    }

    el.dataset.bg = nextUrl;
    el.style.backgroundImage = nextUrl ? `url(${nextUrl})` : '';
    return true;
}
