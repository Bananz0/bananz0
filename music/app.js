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
    maxRecentTracks: 8, // Increased for desktop view
};

// ==========================================
// State Management
// ==========================================
const state = {
    currentTrack: null,
    activeSource: null,
    sources: {
        lastfm: { connected: false, playing: false, track: null },
        spotify: { connected: false, playing: false, track: null },
    },
    recentTracks: [],
    artistCache: new Map(), // Cache artist images
    currentColors: null, // Extracted colors from current track
};

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
};

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
        const response = await fetch(
            `${CONFIG.spotify.workerUrl}?artist=${encodeURIComponent(artistName)}`
        );

        if (!response.ok) throw new Error('Worker request failed');

        const data = await response.json();
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

    try {
        const response = await fetch(
            `${CONFIG.spotify.workerUrl}?track=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artistName)}`
        );

        if (!response.ok) throw new Error('Worker request failed');

        const data = await response.json();
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
}

// ==========================================
// Last.fm Integration
// ==========================================
async function fetchLastFmNowPlaying() {
    if (!CONFIG.lastfm.enabled || !CONFIG.lastfm.apiKey) {
        return null;
    }

    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${CONFIG.lastfm.username}&api_key=${CONFIG.lastfm.apiKey}&format=json&limit=${CONFIG.maxRecentTracks + 1}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Last.fm API error');

        const data = await response.json();
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

        const isSameTrack = state.sources.lastfm.track && state.sources.lastfm.track.name === trackInfo.name;

        // PRESERVE EXISTING IMAGE if track hasn't changed
        // This prevents the "flash" of low-res Last.fm image overwriting the high-res Spotify image
        if (isSameTrack && state.sources.lastfm.track.image) {
            trackInfo.image = state.sources.lastfm.track.image;
            trackInfo.artistImage = state.sources.lastfm.track.artistImage;

            // Still fetch in background to check for updates (silent)
            if (CONFIG.spotify.enabled) {
                getSpotifyTrackData(trackInfo.name, trackInfo.artist).then(spotifyData => {
                    if (spotifyData && spotifyData.artistImage && !trackInfo.artistImage) {
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
                } else {
                    // Timeout - Render Last.fm data first, then update when Spotify arrives
                    spotifyPromise.then(delayedData => {
                        if (delayedData) {
                            if (state.sources.lastfm.playing &&
                                state.sources.lastfm.track &&
                                state.sources.lastfm.track.name === trackInfo.name) {

                                if (delayedData.albumImage) state.sources.lastfm.track.image = delayedData.albumImage;
                                state.sources.lastfm.track.artistImage = delayedData.artistImage;

                                // Re-extract colors for the new high-res image
                                if (delayedData.albumImage) {
                                    extractColors(delayedData.albumImage).then(colors => {
                                        if (colors) applyDynamicColors(colors);
                                    });
                                }

                                if (state.activeSource === 'lastfm') {
                                    updateNowPlayingCard(state.sources.lastfm.track, true);
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

            state.recentTracks = tracks.slice(1, CONFIG.maxRecentTracks + 1).map(track => ({
                name: track.name,
                artist: track.artist['#text'] || track.artist.name,
                image: getLastFmImage(track.image, 'large'),
                date: track.date?.uts ? new Date(track.date.uts * 1000) : null,
            }));

            return state.sources.lastfm.track;
        } else {
            state.sources.lastfm.playing = false;

            state.recentTracks = tracks.slice(0, CONFIG.maxRecentTracks).map(track => ({
                name: track.name,
                artist: track.artist['#text'] || track.artist.name,
                image: getLastFmImage(track.image, 'large'),
                date: track.date?.uts ? new Date(track.date.uts * 1000) : null,
            }));

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

function updateNowPlayingCard(track, isPlaying) {
    if (track) {
        elements.trackName.textContent = track.name;
        elements.artistName.textContent = track.artist;
        elements.albumName.textContent = track.album || '';

        // Album art
        if (track.image) {
            elements.albumArt.src = track.image;
            elements.albumArt.onload = () => elements.albumArt.classList.add('loaded');
            elements.albumArt.onerror = () => elements.albumArt.classList.remove('loaded');
        } else {
            elements.albumArt.classList.remove('loaded');
        }

        // Artist image (thumbnail and backdrop)
        if (track.artistImage) {
            elements.artistThumbnail.src = track.artistImage;
            elements.artistThumbnail.onload = () => {
                elements.artistThumbnailContainer.classList.add('loaded');
            };

            elements.artistBackdrop.style.backgroundImage = `url(${track.artistImage})`;
            elements.artistBackdrop.classList.add('loaded');

            // Immersive Background (Fullscreen)
            if (elements.immersiveBg) {
                elements.immersiveBg.style.backgroundImage = `url(${track.artistImage})`;
            }
        } else {
            elements.artistThumbnailContainer.classList.remove('loaded');
            elements.artistBackdrop.classList.remove('loaded');
            if (elements.immersiveBg) elements.immersiveBg.style.backgroundImage = '';
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
        elements.trackName.textContent = 'Not Playing';
        elements.artistName.textContent = '—';
        elements.albumName.textContent = '';
        elements.albumArt.classList.remove('loaded');
        elements.artistThumbnailContainer.classList.remove('loaded');
        elements.artistBackdrop.classList.remove('loaded');
        elements.playingIndicator.classList.remove('active');

        if (state.recentTracks.length > 0) {
            const lastTrack = state.recentTracks[0];
            elements.trackName.textContent = lastTrack.name;
            elements.artistName.textContent = lastTrack.artist;

            if (lastTrack.image) {
                elements.albumArt.src = lastTrack.image;
                elements.albumArt.onload = () => elements.albumArt.classList.add('loaded');
            }

            const timeAgo = lastTrack.date ? getTimeAgo(lastTrack.date) : 'recently';
            elements.listeningStatus.textContent = `Last played ${timeAgo}`;

            // ENRICHMENT: Fetch high-res art/artist image for the last played track too
            if (CONFIG.spotify.enabled && !lastTrack.enriched) {
                lastTrack.enriched = true; // prevent loop
                getSpotifyTrackData(lastTrack.name, lastTrack.artist).then(spotifyData => {
                    if (spotifyData) {
                        if (spotifyData.albumImage) {
                            lastTrack.image = spotifyData.albumImage;
                            elements.albumArt.src = spotifyData.albumImage;

                            // Also update dynamic colors for high-res image
                            extractColors(spotifyData.albumImage).then(colors => {
                                if (colors) applyDynamicColors(colors);
                            });
                        }
                        if (spotifyData.artistImage) {
                            elements.artistThumbnail.src = spotifyData.artistImage;
                            elements.artistThumbnailContainer.classList.add('loaded');
                            elements.artistBackdrop.style.backgroundImage = `url(${spotifyData.artistImage})`;
                            elements.artistBackdrop.classList.add('loaded');
                            if (elements.immersiveBg) {
                                elements.immersiveBg.style.backgroundImage = `url(${spotifyData.artistImage})`;
                            }
                        }
                    }
                });
            } else if (lastTrack.enriched) {
                // If already enriched, ensure we show the artist bg/thumbnail
                // (we might need to store artistImage on lastTrack object in fetchLastFmNowPlaying loop, but for now we just handle the fetch above)
            }
        } else {
            elements.listeningStatus.textContent = 'Nothing playing';
        }
        elements.listeningStatus.classList.remove('now-playing');
    }
}

function updateRecentTracks() {
    if (!elements.recentTracksList) return;

    elements.recentTracksList.innerHTML = '';

    const tracksToShow = state.activeSource ? state.recentTracks : state.recentTracks.slice(1);

    tracksToShow.forEach(track => {
        const li = document.createElement('li');
        li.innerHTML = `
            <img class="track-thumb" src="${track.image || ''}" alt="" onerror="this.style.display='none'">
            <div class="track-details">
                <div class="name">${escapeHtml(track.name)}</div>
                <div class="artist">${escapeHtml(track.artist)}</div>
            </div>
            <span class="track-time">${track.date ? getTimeAgo(track.date) : ''}</span>
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
    if (elements.artistBackdrop) {
        elements.artistBackdrop.style.background = gradientBlur;
        elements.artistBackdrop.classList.add('loaded');
    }

    // Calculate blended color for a richer glow effect
    const blendedR = Math.round((primaryRaw.r + secondaryRaw.r) / 2);
    const blendedG = Math.round((primaryRaw.g + secondaryRaw.g) / 2);
    const blendedB = Math.round((primaryRaw.b + secondaryRaw.b) / 2);

    // Apply accent colors to card with enhanced glow
    elements.card.style.setProperty('--dynamic-primary', primary);
    elements.card.style.setProperty('--dynamic-secondary', secondary);
    elements.card.style.setProperty('--dynamic-glow-color', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.3)`);
    elements.card.style.setProperty('--dynamic-border-color', `rgba(${primaryRaw.r}, ${primaryRaw.g}, ${primaryRaw.b}, 0.3)`);
    elements.card.style.setProperty('--dynamic-border-color-bright', `rgba(${primaryRaw.r}, ${primaryRaw.g}, ${primaryRaw.b}, 0.6)`);
    elements.card.style.setProperty('--dynamic-scrollbar-color', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.5)`);
    elements.card.style.setProperty('--dynamic-scrollbar-color-bright', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.8)`);
    elements.card.style.borderColor = `rgba(${primaryRaw.r}, ${primaryRaw.g}, ${primaryRaw.b}, 0.3)`;

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
        elements.headerBox.style.borderColor = `rgba(${primaryRaw.r}, ${primaryRaw.g}, ${primaryRaw.b}, 0.3)`;
        elements.headerBox.style.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 25px rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.2)`;
        elements.headerBox.style.setProperty('--dynamic-glow-color', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.2)`);
    }

    // Apply to Recent Tracks Card (via CSS Variables for responsiveness) with enhanced glow
    if (elements.recentTracksCard) {
        elements.recentTracksCard.style.setProperty('--dynamic-border', `rgba(${primaryRaw.r}, ${primaryRaw.g}, ${primaryRaw.b}, 0.3)`);
        elements.recentTracksCard.style.setProperty('--dynamic-shadow', `0 20px 60px rgba(0, 0, 0, 0.3), 0 0 30px rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.2)`);
        elements.recentTracksCard.style.setProperty('--dynamic-glow-color', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.3)`);
        elements.recentTracksCard.style.setProperty('--dynamic-scrollbar-color', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.5)`);
        elements.recentTracksCard.style.setProperty('--dynamic-scrollbar-color-bright', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.8)`);
    }

    // Apply to Social Badges & Home Icon (Main Site Elements) with enhanced glow
    const badges = document.querySelectorAll('.social-badge, .static-logo-badge a');
    badges.forEach(badge => {
        badge.style.setProperty('--dynamic-border-color', `rgba(${primaryRaw.r}, ${primaryRaw.g}, ${primaryRaw.b}, 0.3)`);
        badge.style.setProperty('--dynamic-border-color-bright', `rgba(${primaryRaw.r}, ${primaryRaw.g}, ${primaryRaw.b}, 0.6)`);
        badge.style.setProperty('--dynamic-glow-color', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.25)`);
        badge.style.borderColor = `rgba(${primaryRaw.r}, ${primaryRaw.g}, ${primaryRaw.b}, 0.3)`;
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
        elements.musicHero.style.setProperty('--dynamic-glow-color', `rgba(${blendedR}, ${blendedG}, ${blendedB}, 0.3)`);
    }
}

function resetDynamicColors() {
    if (!elements.card) return;

    // Reset to default theme colors
    elements.card.style.removeProperty('--dynamic-primary');
    elements.card.style.removeProperty('--dynamic-secondary');
    elements.card.style.borderColor = '';

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

    if (elements.recentTracksCard) {
        elements.recentTracksCard.style.removeProperty('--dynamic-border');
        elements.recentTracksCard.style.removeProperty('--dynamic-shadow');
    }
}

// ==========================================
// Utility Functions
// ==========================================
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
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
// Initialize
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // GPU Optimization: Disable particle effects on music page
    // The immersive background already provides rich visuals
    const particleCanvas = document.getElementById('particles');
    if (particleCanvas) {
        particleCanvas.style.display = 'none';
        console.log('Particle system disabled for music page (GPU optimization)');
    }

    // Also hide the grid background for cleaner immersive view
    const gridBg = document.querySelector('.grid-bg');
    if (gridBg) {
        gridBg.style.opacity = '0';
    }

    // Check if Last.fm API key is configured
    if (!CONFIG.lastfm.apiKey) {
        elements.listeningStatus.textContent = 'API key not configured';
        elements.trackName.textContent = 'Setup Required';
        elements.artistName.textContent = 'Add LASTFM_API_KEY to your environment';
        console.warn('Last.fm API key not configured. Set LASTFM_API_KEY in _config.yml or as a GitHub secret.');
        return;
    }

    // Start the polling
    startPolling();



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
        spotify: CONFIG.spotify.clientId ? 'configured' : 'missing (artist images will be unavailable)',
    });
});
