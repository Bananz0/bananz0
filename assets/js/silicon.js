// ==========================================
// SILICON ARTWORK
// Generative die shot (hero, Fig. 1) and wafer map (footer).
// Everything is drawn from a seeded PRNG, so a seed always gives the same chip.
// The die's static layers are rendered once to an offscreen canvas; the only
// per-frame work is a handful of signal pulses and the ring-oscillator stage.
// Animation only runs while the canvas is on screen, and never under
// prefers-reduced-motion.
// ==========================================
(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const GOLD = [227, 177, 95];
    const STEEL = [138, 166, 180];
    const SUBSTRATE = '#15171c';

    const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const newSeed = () => (Math.random() * 0xFFFFFF) >>> 0;
    const hex = (n) => '0x' + n.toString(16).toUpperCase().padStart(6, '0');

    function sizeCanvas(canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(1, Math.round(rect.width * dpr));
        const h = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        return { w, h, dpr };
    }

    // ------------------------------------------------------------------
    // Die generator
    // ------------------------------------------------------------------
    function buildDie(seed, W, H, dpr) {
        const rnd = mulberry32(seed);
        const range = (a, b) => a + (b - a) * rnd();
        const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

        const layer = document.createElement('canvas');
        layer.width = W;
        layer.height = H;
        const g = layer.getContext('2d');
        const px = dpr; // one CSS pixel

        const S = Math.min(W, H);
        const die = { s: S * 0.66 };
        die.x = (W - die.s) / 2;
        die.y = (H - die.s) / 2;

        const pads = [];
        const buses = [];
        let ro = null;

        // --- lead frame fingers + bond wires (drawn first, under the die) ---
        const perSide = 10 + Math.floor(rnd() * 5);
        const padSize = die.s * 0.042;
        const ringInset = die.s * 0.035;
        for (let side = 0; side < 4; side++) {
            for (let i = 0; i < perSide; i++) {
                if (rnd() < 0.12) continue; // unbonded / missing pad
                const t = (i + 0.5) / perSide;
                const along = die.s * 0.1 + t * die.s * 0.8;
                let x, y;
                if (side === 0) { x = die.x + along; y = die.y + ringInset; }
                if (side === 1) { x = die.x + die.s - ringInset; y = die.y + along; }
                if (side === 2) { x = die.x + die.s - along; y = die.y + die.s - ringInset; }
                if (side === 3) { x = die.x + ringInset; y = die.y + die.s - along; }
                pads.push({ x, y, side, t });
            }
        }

        // Fingers sit on the canvas border, fanned out from the die centre
        const cx = W / 2;
        const cy = H / 2;
        g.lineCap = 'round';
        pads.forEach((p) => {
            const spread = (p.t - 0.5) * 1.5;
            let fx, fy;
            const reach = S * 0.48;
            if (p.side === 0) { fx = cx + spread * reach; fy = cy - reach; }
            if (p.side === 1) { fx = cx + reach; fy = cy + spread * reach; }
            if (p.side === 2) { fx = cx - spread * reach; fy = cy + reach; }
            if (p.side === 3) { fx = cx - reach; fy = cy - spread * reach; }
            p.fx = fx;
            p.fy = fy;

            // finger
            const ang = Math.atan2(fy - p.y, fx - p.x);
            g.save();
            g.translate(fx, fy);
            g.rotate(ang);
            g.fillStyle = 'rgba(160, 168, 180, 0.12)';
            g.fillRect(-2 * px, -2.2 * px, S * 0.06, 4.4 * px);
            g.restore();
        });

        // --- die body ---
        g.fillStyle = SUBSTRATE;
        g.fillRect(die.x, die.y, die.s, die.s);
        const sheen = g.createLinearGradient(die.x, die.y, die.x + die.s, die.y + die.s);
        sheen.addColorStop(0, 'rgba(120, 150, 190, 0.07)');
        sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.0)');
        sheen.addColorStop(1, 'rgba(190, 140, 90, 0.06)');
        g.fillStyle = sheen;
        g.fillRect(die.x, die.y, die.s, die.s);

        // seal ring (double)
        g.strokeStyle = 'rgba(200, 205, 215, 0.22)';
        g.lineWidth = px;
        g.strokeRect(die.x + 3 * px, die.y + 3 * px, die.s - 6 * px, die.s - 6 * px);
        g.strokeStyle = 'rgba(200, 205, 215, 0.12)';
        g.strokeRect(die.x + 6 * px, die.y + 6 * px, die.s - 12 * px, die.s - 12 * px);

        // alignment marks in the corners
        const mark = (mx, my) => {
            const m = die.s * 0.018;
            g.strokeStyle = rgba(GOLD, 0.35);
            g.beginPath();
            g.moveTo(mx - m, my); g.lineTo(mx + m, my);
            g.moveTo(mx, my - m); g.lineTo(mx, my + m);
            g.stroke();
        };
        const mOff = die.s * 0.045;
        mark(die.x + mOff, die.y + mOff);
        mark(die.x + die.s - mOff, die.y + die.s - mOff);

        // --- core: guillotine partition with routing channels ---
        const coreInset = die.s * 0.1;
        const core = { x: die.x + coreInset, y: die.y + coreInset, w: die.s - 2 * coreInset, h: die.s - 2 * coreInset };
        const gap = Math.max(4 * px, core.w * 0.028);
        const leaves = [];

        (function split(r, depth) {
            const small = Math.min(r.w, r.h) < core.w * 0.16;
            if (depth > 4 || small || (depth > 1 && rnd() < 0.18)) {
                leaves.push(r);
                return;
            }
            const vertical = r.w / r.h > 1.25 ? true : r.h / r.w > 1.25 ? false : rnd() < 0.5;
            const ratio = range(0.32, 0.68);
            if (vertical) {
                const w1 = (r.w - gap) * ratio;
                buses.push({ x1: r.x + w1 + gap / 2, y1: r.y, x2: r.x + w1 + gap / 2, y2: r.y + r.h, width: gap });
                split({ x: r.x, y: r.y, w: w1, h: r.h }, depth + 1);
                split({ x: r.x + w1 + gap, y: r.y, w: r.w - w1 - gap, h: r.h }, depth + 1);
            } else {
                const h1 = (r.h - gap) * ratio;
                buses.push({ x1: r.x, y1: r.y + h1 + gap / 2, x2: r.x + r.w, y2: r.y + h1 + gap / 2, width: gap });
                split({ x: r.x, y: r.y, w: r.w, h: h1 }, depth + 1);
                split({ x: r.x, y: r.y + h1 + gap, w: r.w, h: r.h - h1 - gap }, depth + 1);
            }
        })(core, 0);

        // pick a mid-sized, wide-ish leaf for the ring oscillator
        const roCandidates = leaves
            .map((r, i) => ({ r, i, score: Math.abs(r.w / r.h - 1.8) + Math.abs(r.w * r.h / (core.w * core.h) - 0.06) * 8 }))
            .sort((a, b) => a.score - b.score);
        const roIndex = roCandidates.length ? roCandidates[0].i : -1;
        let markIndex = -1;

        leaves.forEach((r, i) => {
            let type;
            if (i === roIndex) type = 'ro';
            else {
                const k = rnd();
                type = k < 0.42 ? 'std' : k < 0.72 ? 'sram' : k < 0.88 ? 'analog' : 'fill';
                if (type === 'fill' && markIndex < 0) markIndex = i;
            }
            drawBlock(r, type);
        });
        if (markIndex < 0) {
            // no fill block: put the die marking in the bottom-left channel corner
            markIndex = -2;
        }

        // --- routing buses in the channels ---
        buses.forEach((b) => {
            const lines = Math.max(2, Math.floor(b.width / (2.2 * px)) - 1);
            const vertical = b.x1 === b.x2;
            for (let k = 0; k < lines; k++) {
                const off = (k - (lines - 1) / 2) * 2.2 * px;
                const gold = rnd() < 0.35;
                g.strokeStyle = gold ? rgba(GOLD, 0.28) : 'rgba(170, 180, 195, 0.14)';
                g.lineWidth = px * (gold ? 1 : 0.8);
                g.beginPath();
                if (vertical) { g.moveTo(b.x1 + off, b.y1); g.lineTo(b.x2 + off, b.y2); }
                else { g.moveTo(b.x1, b.y1 + off); g.lineTo(b.x2, b.y2 + off); }
                g.stroke();
            }
        });

        // --- pads, ESD cells and pad-to-core traces ---
        pads.forEach((p) => {
            const h = padSize / 2;
            // trace into the core
            const tx = p.side === 1 ? core.x + core.w : p.side === 3 ? core.x : p.x;
            const ty = p.side === 0 ? core.y : p.side === 2 ? core.y + core.h : p.y;
            g.strokeStyle = 'rgba(170, 180, 195, 0.16)';
            g.lineWidth = px;
            g.beginPath();
            g.moveTo(p.x, p.y);
            g.lineTo(tx, ty);
            g.stroke();
            // ESD clamp
            const ex = (p.x + tx) / 2;
            const ey = (p.y + ty) / 2;
            g.fillStyle = 'rgba(150, 160, 175, 0.16)';
            g.fillRect(ex - h * 0.6, ey - h * 0.6, h * 1.2, h * 1.2);
            // pad
            const pg = g.createLinearGradient(p.x - h, p.y - h, p.x + h, p.y + h);
            pg.addColorStop(0, '#f0cd8a');
            pg.addColorStop(1, '#a8772f');
            g.fillStyle = pg;
            g.fillRect(p.x - h, p.y - h, padSize, padSize);
            g.fillStyle = 'rgba(20, 16, 10, 0.35)';
            g.fillRect(p.x - h * 0.62, p.y - h * 0.62, h * 1.24, h * 1.24);
        });

        // --- bond wires on top ---
        pads.forEach((p) => {
            const mx = (p.x + p.fx) / 2;
            const my = (p.y + p.fy) / 2;
            // bow the wire slightly away from the centre so it reads as 3D
            const nx = mx - cx;
            const ny = my - cy;
            const nl = Math.hypot(nx, ny) || 1;
            const bow = S * 0.035;
            const qx = mx + (nx / nl) * bow;
            const qy = my + (ny / nl) * bow;
            g.lineWidth = 1.4 * px;
            g.strokeStyle = 'rgba(120, 85, 35, 0.55)';
            g.beginPath();
            g.moveTo(p.x, p.y + 0.8 * px);
            g.quadraticCurveTo(qx, qy + 0.8 * px, p.fx, p.fy + 0.8 * px);
            g.stroke();
            g.lineWidth = 0.9 * px;
            g.strokeStyle = rgba(GOLD, 0.8);
            g.beginPath();
            g.moveTo(p.x, p.y);
            g.quadraticCurveTo(qx, qy, p.fx, p.fy);
            g.stroke();
            // ball bond
            g.fillStyle = '#f3d79c';
            g.beginPath();
            g.arc(p.x, p.y, padSize * 0.22, 0, Math.PI * 2);
            g.fill();
        });

        // --- die marking ---
        const markRect = markIndex >= 0 ? leaves[markIndex] : { x: core.x, y: core.y + core.h + gap * 0.2, w: core.w * 0.4, h: coreInset * 0.5 };
        const fs = Math.max(7 * px, Math.min(markRect.h * 0.22, die.s * 0.026));
        g.font = `500 ${fs}px "JetBrains Mono", ui-monospace, monospace`;
        g.fillStyle = rgba(GOLD, 0.55);
        g.textBaseline = 'top';
        g.fillText('GM-RTC1', markRect.x + fs * 0.6, markRect.y + fs * 0.6);
        g.fillStyle = 'rgba(200, 205, 215, 0.3)';
        g.fillText(hex(seed).slice(2), markRect.x + fs * 0.6, markRect.y + fs * 1.85);

        return { layer, buses, ro, die };

        // ---------- block painters ----------
        function drawBlock(r, type) {
            // thin-film interference tint, the reason real die shots shimmer
            const hue = pick([200, 215, 260, 35, 160]);
            g.fillStyle = `hsla(${hue}, 30%, 55%, ${range(0.03, 0.08)})`;
            g.fillRect(r.x, r.y, r.w, r.h);
            g.strokeStyle = 'rgba(255, 255, 255, 0.07)';
            g.lineWidth = px;
            g.strokeRect(r.x + 0.5 * px, r.y + 0.5 * px, r.w - px, r.h - px);

            const pad = Math.max(2 * px, Math.min(r.w, r.h) * 0.06);
            const b = { x: r.x + pad, y: r.y + pad, w: r.w - 2 * pad, h: r.h - 2 * pad };
            if (b.w <= 0 || b.h <= 0) return;
            if (type === 'std') drawStdCells(b);
            else if (type === 'sram') drawSram(b);
            else if (type === 'analog') drawAnalog(b);
            else if (type === 'ro') drawRingOsc(b);
            else drawFill(b);
        }

        function drawStdCells(b) {
            const rowH = Math.max(3 * px, core.w * 0.013);
            for (let y = b.y; y + rowH <= b.y + b.h; y += rowH) {
                // power rail
                g.fillStyle = rgba(GOLD, 0.16);
                g.fillRect(b.x, y, b.w, Math.max(0.6 * px, rowH * 0.1));
                let x = b.x;
                while (x < b.x + b.w) {
                    const cw = Math.min(b.x + b.w - x, rowH * range(0.4, 2.6));
                    const l = Math.floor(range(30, 62));
                    g.fillStyle = `rgb(${l}, ${l + 3}, ${l + 9})`;
                    g.fillRect(x, y + rowH * 0.18, cw - 0.6 * px, rowH * 0.74);
                    x += cw;
                }
            }
            // M2 straps
            g.strokeStyle = 'rgba(190, 200, 215, 0.08)';
            g.lineWidth = px;
            const step = Math.max(8 * px, b.w / Math.floor(range(5, 11)));
            for (let x = b.x + step / 2; x < b.x + b.w; x += step) {
                g.beginPath();
                g.moveTo(x, b.y);
                g.lineTo(x, b.y + b.h);
                g.stroke();
            }
        }

        function drawSram(b) {
            const dec = Math.max(3 * px, b.w * 0.08);
            const sense = Math.max(3 * px, b.h * 0.08);
            // decoder strip + sense amps
            drawStdCellsStrip({ x: b.x, y: b.y, w: dec, h: b.h - sense });
            drawStdCellsStrip({ x: b.x, y: b.y + b.h - sense, w: b.w, h: sense });
            const a = { x: b.x + dec + px, y: b.y, w: b.w - dec - px, h: b.h - sense - px };
            const banksX = a.w > a.h ? 2 : 1;
            const banksY = a.h > a.w * 0.8 ? 2 : 1;
            const bg = Math.max(1.5 * px, a.w * 0.02);
            const bw = (a.w - bg * (banksX - 1)) / banksX;
            const bh = (a.h - bg * (banksY - 1)) / banksY;
            for (let i = 0; i < banksX; i++) {
                for (let j = 0; j < banksY; j++) {
                    const x0 = a.x + i * (bw + bg);
                    const y0 = a.y + j * (bh + bg);
                    g.fillStyle = 'rgba(70, 76, 88, 0.55)';
                    g.fillRect(x0, y0, bw, bh);
                    const cw = Math.max(1.6 * px, core.w * 0.0065);
                    g.fillStyle = 'rgba(15, 17, 21, 0.5)';
                    for (let y = y0; y < y0 + bh; y += cw * 1.4) g.fillRect(x0, y, bw, 0.6 * px);
                    g.fillStyle = 'rgba(200, 205, 215, 0.06)';
                    for (let x = x0; x < x0 + bw; x += cw) g.fillRect(x, y0, 0.5 * px, bh);
                }
            }
        }

        function drawStdCellsStrip(b) {
            g.fillStyle = 'rgba(48, 52, 60, 0.9)';
            g.fillRect(b.x, b.y, b.w, b.h);
            g.fillStyle = 'rgba(200, 205, 215, 0.07)';
            const step = 1.6 * px;
            if (b.w > b.h) for (let x = b.x; x < b.x + b.w; x += step * range(1, 3)) g.fillRect(x, b.y, 0.6 * px, b.h);
            else for (let y = b.y; y < b.y + b.h; y += step * range(1, 3)) g.fillRect(b.x, y, b.w, 0.6 * px);
        }

        function drawAnalog(b) {
            // interdigitated capacitor on one half, serpentine resistor on the other
            const half = b.w > b.h ? { x: b.x, y: b.y, w: b.w / 2 - px, h: b.h } : { x: b.x, y: b.y, w: b.w, h: b.h / 2 - px };
            const rest = b.w > b.h ? { x: b.x + b.w / 2 + px, y: b.y, w: b.w / 2 - px, h: b.h } : { x: b.x, y: b.y + b.h / 2 + px, w: b.w, h: b.h / 2 - px };

            const fw = Math.max(1.2 * px, half.w / 26);
            g.fillStyle = rgba(GOLD, 0.3);
            g.fillRect(half.x, half.y, half.w, fw);
            g.fillRect(half.x, half.y + half.h - fw, half.w, fw);
            let k = 0;
            for (let x = half.x + fw; x < half.x + half.w - fw; x += fw * 2, k++) {
                g.fillStyle = k % 2 ? rgba(GOLD, 0.26) : 'rgba(180, 190, 205, 0.2)';
                if (k % 2) g.fillRect(x, half.y + fw, fw, half.h - fw * 3);
                else g.fillRect(x, half.y + fw * 2, fw, half.h - fw * 3);
            }

            g.strokeStyle = 'rgba(180, 190, 205, 0.22)';
            g.lineWidth = Math.max(px, rest.w / 40);
            g.beginPath();
            const turns = Math.max(3, Math.floor(rest.w / (6 * px)));
            const sx = rest.w / turns;
            g.moveTo(rest.x + sx / 2, rest.y + rest.h);
            for (let i = 0; i < turns; i++) {
                const x = rest.x + sx / 2 + i * sx;
                g.lineTo(x, i % 2 ? rest.y + rest.h * 0.08 : rest.y + rest.h * 0.92);
                g.lineTo(x + sx, i % 2 ? rest.y + rest.h * 0.08 : rest.y + rest.h * 0.92);
            }
            g.stroke();
        }

        function drawFill(b) {
            const step = Math.max(4 * px, core.w * 0.016);
            g.fillStyle = 'rgba(200, 205, 215, 0.06)';
            for (let y = b.y; y < b.y + b.h; y += step) {
                for (let x = b.x + ((y - b.y) / step % 2 ? step / 2 : 0); x < b.x + b.w; x += step) {
                    g.fillRect(x, y, step * 0.35, step * 0.35);
                }
            }
        }

        function drawRingOsc(b) {
            // Five identical inverter cells in a row with a feedback wire looping
            // back over the top: the RTC's 5-stage ring oscillator.
            const n = 5;
            const loop = b.h * 0.22;
            const cellW = b.w / n;
            const cellH = b.h - loop * 1.6;
            const top = b.y + loop * 1.3;
            const cells = [];
            for (let i = 0; i < n; i++) {
                const x = b.x + i * cellW + cellW * 0.12;
                const w = cellW * 0.76;
                // pmos (top) / nmos (bottom) diffusion
                g.fillStyle = 'rgba(160, 120, 170, 0.22)';
                g.fillRect(x, top, w, cellH * 0.38);
                g.fillStyle = 'rgba(110, 160, 150, 0.22)';
                g.fillRect(x, top + cellH * 0.62, w, cellH * 0.38);
                // poly gate
                g.fillStyle = rgba(GOLD, 0.45);
                g.fillRect(x + w * 0.45, top - cellH * 0.04, w * 0.1, cellH * 1.08);
                cells.push({ x, y: top, w, h: cellH });
                // stage-to-stage link
                if (i < n - 1) {
                    g.strokeStyle = 'rgba(200, 205, 215, 0.3)';
                    g.lineWidth = px;
                    g.beginPath();
                    g.moveTo(x + w, top + cellH / 2);
                    g.lineTo(x + cellW, top + cellH / 2);
                    g.stroke();
                }
            }
            // feedback loop
            const first = cells[0];
            const last = cells[n - 1];
            const path = [
                [last.x + last.w, first.y + first.h / 2],
                [last.x + last.w + cellW * 0.08, first.y + first.h / 2],
                [last.x + last.w + cellW * 0.08, b.y + loop * 0.5],
                [first.x - cellW * 0.08, b.y + loop * 0.5],
                [first.x - cellW * 0.08, first.y + first.h / 2],
                [first.x, first.y + first.h / 2]
            ];
            g.strokeStyle = rgba(GOLD, 0.5);
            g.lineWidth = 1.2 * px;
            g.beginPath();
            path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
            g.stroke();
            ro = { cells, path };
        }
    }

    // ------------------------------------------------------------------
    // Hero die: render, animate, re-spin
    // ------------------------------------------------------------------
    function initDie(canvas) {
        const seedLabel = document.querySelector('[data-die-seed]');
        const respin = document.querySelector('[data-die-respin]');
        const ctx = canvas.getContext('2d');
        let seed = newSeed();
        let chip = null;
        let pulses = [];
        let visible = false;
        let raf = 0;
        let last = 0;
        let dpr = 1;

        function render() {
            const size = sizeCanvas(canvas);
            dpr = size.dpr;
            chip = buildDie(seed, size.w, size.h, size.dpr);
            pulses = [];
            if (seedLabel) seedLabel.textContent = hex(seed);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(chip.layer, 0, 0);
            canvas.classList.add('is-drawn');
        }

        function spawnPulse() {
            if (!chip || !chip.buses.length) return;
            const b = chip.buses[Math.floor(Math.random() * chip.buses.length)];
            const lanes = Math.max(1, Math.floor(b.width / (2.2 * dpr)) - 1);
            const off = (Math.floor(Math.random() * lanes) - (lanes - 1) / 2) * 2.2 * dpr;
            const vertical = b.x1 === b.x2;
            const fwd = Math.random() < 0.5;
            const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
            pulses.push({
                x1: (fwd ? b.x1 : b.x2) + (vertical ? off : 0),
                y1: (fwd ? b.y1 : b.y2) + (vertical ? 0 : off),
                x2: (fwd ? b.x2 : b.x1) + (vertical ? off : 0),
                y2: (fwd ? b.y2 : b.y1) + (vertical ? 0 : off),
                t: 0,
                speed: (60 + Math.random() * 90) * dpr / len
            });
        }

        function frame(now) {
            raf = 0;
            if (!visible || reduceMotion.matches || document.hidden || !chip) return;
            const dt = Math.min(0.05, (now - (last || now)) / 1000);
            last = now;

            if (pulses.length < 9 && Math.random() < dt * 6) spawnPulse();

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(chip.layer, 0, 0);

            ctx.lineCap = 'round';
            pulses = pulses.filter((p) => {
                p.t += p.speed * dt;
                if (p.t > 1.15) return false;
                const head = Math.min(1, p.t);
                const tail = Math.max(0, p.t - 0.15);
                const hx = p.x1 + (p.x2 - p.x1) * head;
                const hy = p.y1 + (p.y2 - p.y1) * head;
                const tx = p.x1 + (p.x2 - p.x1) * tail;
                const ty = p.y1 + (p.y2 - p.y1) * tail;
                ctx.strokeStyle = rgba(GOLD, 0.18);
                ctx.lineWidth = 4 * dpr;
                ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
                ctx.strokeStyle = 'rgba(255, 236, 196, 0.9)';
                ctx.lineWidth = 1.2 * dpr;
                ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
                return true;
            });

            // ring oscillator: one stage switches at a time, ~1.6 Hz round trip
            if (chip.ro) {
                const stage = Math.floor(now / 125) % chip.ro.cells.length;
                const c = chip.ro.cells[stage];
                ctx.fillStyle = rgba(GOLD, 0.22);
                ctx.fillRect(c.x - dpr, c.y - dpr, c.w + 2 * dpr, c.h + 2 * dpr);
                ctx.strokeStyle = rgba(GOLD, 0.8);
                ctx.lineWidth = dpr;
                ctx.strokeRect(c.x - dpr, c.y - dpr, c.w + 2 * dpr, c.h + 2 * dpr);
            }

            schedule();
        }

        function schedule() {
            if (!raf && visible && !reduceMotion.matches && !document.hidden) {
                raf = requestAnimationFrame(frame);
            }
        }

        new IntersectionObserver((entries) => {
            visible = entries[0].isIntersecting;
            if (visible) {
                if (!chip) render();
                last = 0;
                schedule();
            }
        }, { rootMargin: '100px' }).observe(canvas);

        document.addEventListener('visibilitychange', () => { last = 0; schedule(); });
        reduceMotion.addEventListener?.('change', () => { render(); schedule(); });

        let resizeTimer = 0;
        new ResizeObserver(() => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => { if (chip) { render(); schedule(); } }, 150);
        }).observe(canvas);

        if (respin) {
            respin.addEventListener('click', () => {
                seed = newSeed();
                canvas.classList.remove('is-drawn');
                // let the fade-out land before swapping the chip
                setTimeout(() => { render(); schedule(); }, reduceMotion.matches ? 0 : 180);
            });
        }
    }

    // ------------------------------------------------------------------
    // Footer wafer map
    // ------------------------------------------------------------------
    function drawWafer(canvas) {
        const { w, h, dpr } = sizeCanvas(canvas);
        const g = canvas.getContext('2d');
        const rnd = mulberry32(newSeed());
        const R = Math.min(w, h) / 2 - 2 * dpr;
        const cx = w / 2;
        const cy = h / 2;
        const n = 15;
        const pitch = (2 * R) / n;
        const gap = Math.max(0.8 * dpr, pitch * 0.12);

        // a scratch / cluster defect somewhere on the wafer
        const da = rnd() * Math.PI * 2;
        const dr = rnd() * R * 0.7;
        const defect = { x: cx + Math.cos(da) * dr, y: cy + Math.sin(da) * dr, r: R * (0.15 + rnd() * 0.15) };

        g.clearRect(0, 0, w, h);
        g.strokeStyle = 'rgba(200, 205, 215, 0.25)';
        g.lineWidth = dpr;
        g.beginPath();
        // flat notch at the bottom
        const notch = 0.09;
        g.arc(cx, cy, R, Math.PI / 2 + notch, Math.PI / 2 - notch + Math.PI * 2);
        g.closePath();
        g.stroke();

        const passing = [];
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const x = cx - R + i * pitch;
                const y = cy - R + j * pitch;
                const corners = [[x, y], [x + pitch, y], [x, y + pitch], [x + pitch, y + pitch]];
                if (!corners.every(([px, py]) => Math.hypot(px - cx, py - cy) < R - gap)) continue;
                const mx = x + pitch / 2;
                const my = y + pitch / 2;
                const edge = Math.hypot(mx - cx, my - cy) / R;
                let yieldP = 0.96 - Math.pow(edge, 5) * 0.55;
                if (Math.hypot(mx - defect.x, my - defect.y) < defect.r) yieldP -= 0.55;
                const pass = rnd() < yieldP;
                g.fillStyle = pass ? rgba(GOLD, 0.5) : rgba(STEEL, 0.14);
                g.fillRect(x + gap / 2, y + gap / 2, pitch - gap, pitch - gap);
                if (pass) passing.push([x, y]);
            }
        }
        // the die in Fig. 1, picked off the wafer
        if (passing.length) {
            const [x, y] = passing[Math.floor(passing.length * 0.45)];
            g.strokeStyle = 'rgba(255, 236, 196, 0.95)';
            g.lineWidth = dpr;
            g.strokeRect(x + gap / 2 - dpr, y + gap / 2 - dpr, pitch - gap + 2 * dpr, pitch - gap + 2 * dpr);
        }
    }

    function initWafer(canvas) {
        new IntersectionObserver((entries, obs) => {
            if (entries[0].isIntersecting) {
                drawWafer(canvas);
                obs.disconnect();
            }
        }, { rootMargin: '200px' }).observe(canvas);
    }

    function init() {
        const die = document.querySelector('[data-die]');
        if (die && die.getContext) initDie(die);
        const wafer = document.querySelector('[data-wafer]');
        if (wafer && wafer.getContext) initWafer(wafer);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
