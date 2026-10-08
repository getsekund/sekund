/**
 * SEKUND dots: ordered-dither halftone and a slow dot field, on Canvas 2D.
 * No dependencies. Spec: docs/brand/DESIGN.md, section 10.
 */
const FALLBACK = {
    ink: "#141517",
    paper: "#E9EAE4",
    rule: "#BFC1B9",
    lcd: "#B4BCA6",
    segment: "#1D221C",
    ghost: "#A9B19B",
};
const TOKENS = {
    pitchFine: 4,
    pitch: 6,
    pitchTerrain: 8,
    pitchTitle: 9,
    size: 0.78,
    sizeMax: 0.9,
    sizeLcd: 0.8,
    levels: 4,
    period: 8,
    fps: 24,
    loaderPeriod: 2.4,
    loaderFps: 10,
};
/** 8×8 Bayer index matrix, row-major. Threshold for cell (x, y) is (B + 0.5) / 64. */
export const BAYER8 = [
    0, 32, 8, 40, 2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37,
    63, 31, 55, 23, 61, 29, 53, 21,
];
export function bayer(x, y) {
    return (BAYER8[(y & 7) * 8 + (x & 7)] + 0.5) / 64;
}
function styles(el) {
    if (typeof document === "undefined")
        return null;
    return getComputedStyle(el ?? document.documentElement);
}
/** Reads the --sk-* color tokens, falling back to the DESIGN.md values. */
export function readPalette(el) {
    const cs = styles(el);
    if (!cs)
        return { ...FALLBACK };
    const get = (name, fb) => cs.getPropertyValue(name).trim() || fb;
    return {
        ink: get("--sk-ink", FALLBACK.ink),
        paper: get("--sk-paper", FALLBACK.paper),
        rule: get("--sk-rule", FALLBACK.rule),
        lcd: get("--sk-lcd", FALLBACK.lcd),
        segment: get("--sk-segment", FALLBACK.segment),
        ghost: get("--sk-ghost", FALLBACK.ghost),
    };
}
/** Reads the --sk-dot-* tokens. Pitches in CSS px, periods in seconds. */
export function readDotTokens(el) {
    const cs = styles(el);
    if (!cs)
        return { ...TOKENS };
    const num = (name, fb) => {
        const v = cs.getPropertyValue(name).trim();
        if (!v)
            return fb;
        const n = parseFloat(v);
        if (!Number.isFinite(n))
            return fb;
        return v.endsWith("ms") ? n / 1000 : n;
    };
    return {
        pitchFine: num("--sk-dot-pitch-fine", TOKENS.pitchFine),
        pitch: num("--sk-dot-pitch", TOKENS.pitch),
        pitchTerrain: num("--sk-dot-pitch-terrain", TOKENS.pitchTerrain),
        pitchTitle: num("--sk-dot-pitch-title", TOKENS.pitchTitle),
        size: num("--sk-dot-size", TOKENS.size),
        sizeMax: num("--sk-dot-size-max", TOKENS.sizeMax),
        sizeLcd: num("--sk-dot-size-lcd", TOKENS.sizeLcd),
        levels: num("--sk-dot-levels", TOKENS.levels),
        period: num("--sk-dot-period", TOKENS.period),
        fps: num("--sk-dot-fps", TOKENS.fps),
        loaderPeriod: num("--sk-dot-loader-period", TOKENS.loaderPeriod),
        loaderFps: num("--sk-dot-loader-fps", TOKENS.loaderFps),
    };
}
/** Sizes the canvas backing store to its CSS box times devicePixelRatio. Returns the scale. */
export function fitCanvas(canvas, cssWidth, cssHeight) {
    const dpr = Math.max(1, Math.round((globalThis.devicePixelRatio || 1) * 100) / 100);
    const w = cssWidth ?? canvas.clientWidth;
    const h = cssHeight ?? canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (cssWidth !== undefined)
        canvas.style.width = `${cssWidth}px`;
    if (cssHeight !== undefined)
        canvas.style.height = `${cssHeight}px`;
    return dpr;
}
function ctx2d(canvas) {
    const c = canvas.getContext("2d");
    if (!c)
        throw new Error("sekund-dots: 2D context unavailable");
    return c;
}
function scratch(w, h) {
    const off = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
    return ctx2d(off);
}
function scaleOf(canvas, explicit) {
    if (explicit)
        return explicit;
    const cw = canvas.clientWidth;
    return cw > 0 ? canvas.width / cw : 1;
}
function batch(shape) {
    const xs = [];
    return {
        add(cx, cy, d) {
            if (d > 0.35)
                xs.push(cx, cy, d);
        },
        fill(ctx, color) {
            ctx.fillStyle = color;
            ctx.beginPath();
            for (let i = 0; i < xs.length; i += 3) {
                const cx = xs[i], cy = xs[i + 1], d = xs[i + 2];
                if (shape === "square") {
                    const s = Math.max(1, Math.round(d));
                    ctx.rect(Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
                }
                else {
                    ctx.moveTo(cx + d / 2, cy);
                    ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
                }
            }
            ctx.fill();
        },
    };
}
function paintBackground(ctx, w, h, bg) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (bg === null)
        ctx.clearRect(0, 0, w, h);
    else {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
    }
}
/** Darkness 0..1 per cell, from an image drawn into a cols × rows buffer (area-averaged by the browser). */
export function sampleTone(source, cols, rows, o = {}) {
    const black = o.black ?? 0.06, white = o.white ?? 0.86, gamma = o.gamma ?? 1;
    const c = scratch(cols, rows);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.fillStyle = "#fff";
    c.fillRect(0, 0, cols, rows);
    const sw = source.naturalWidth || source.width;
    const sh = source.naturalHeight || source.height;
    const k = o.fit === "cover" ? Math.max(cols / sw, rows / sh) : Math.min(cols / sw, rows / sh);
    const dw = sw * k, dh = sh * k;
    c.drawImage(source, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
    const px = c.getImageData(0, 0, cols, rows).data;
    const out = new Float32Array(cols * rows);
    for (let i = 0; i < out.length; i++) {
        const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const t = Math.min(1, Math.max(0, (white - lum) / (white - black)));
        out[i] = Math.pow(t, gamma);
    }
    return out;
}
/**
 * Hard-edged coverage per cell (0 or 1) for shapes such as the wordmark. `rect` is in cells.
 * Supersampled `ss` × `ss` and thresholded so letter edges stay crisp instead of fuzzy.
 */
export function maskTone(source, cols, rows, rect, threshold = 0.5, ss = 4) {
    const w = cols * ss, h = rows * ss;
    const c = scratch(w, h);
    c.drawImage(source, rect.x * ss, rect.y * ss, rect.w * ss, rect.h * ss);
    const a = c.getImageData(0, 0, w, h).data;
    const out = new Float32Array(cols * rows);
    const limit = threshold * ss * ss * 255;
    for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
            let sum = 0;
            for (let j = 0; j < ss; j++)
                for (let i = 0; i < ss; i++)
                    sum += a[((y * ss + j) * w + x * ss + i) * 4 + 3];
            out[y * cols + x] = sum >= limit ? 1 : 0;
        }
    return out;
}
/** Draws a tone field (darkness per cell) as dots, centered on the canvas. Shared by images and the dot field. */
export function drawTone(canvas, tone, cols, rows, o = {}) {
    const pal = readPalette(canvas);
    const tk = readDotTokens(canvas);
    const lcd = o.surface === "lcd";
    const s = scaleOf(canvas, o.scale);
    const P = (o.pitch ?? tk.pitch) * s;
    const mode = lcd ? "dither" : o.mode ?? "dither";
    const levels = Math.max(1, Math.round(o.levels ?? tk.levels));
    const dot = (o.dot ?? (lcd ? tk.sizeLcd : tk.size)) * P;
    const maxDot = (o.maxDot ?? tk.sizeMax) * P;
    const ctx = ctx2d(canvas);
    paintBackground(ctx, canvas.width, canvas.height, o.background === undefined ? (lcd ? pal.lcd : pal.paper) : o.background);
    const ox = (canvas.width - cols * P) / 2, oy = (canvas.height - rows * P) / 2;
    const b = batch(o.shape ?? (lcd ? "square" : "round"));
    let on = 0;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const t = tone[y * cols + x];
            const th = bayer(x, y);
            let d = 0;
            if (mode === "dither") {
                if (t > th)
                    d = dot;
            }
            else {
                const q = Math.min(levels, Math.floor(t * levels + th)) / levels;
                d = Math.sqrt(q) * maxDot;
            }
            if (d > 0) {
                on++;
                b.add(ox + (x + 0.5) * P, oy + (y + 0.5) * P, d);
            }
        }
    }
    b.fill(ctx, o.color ?? (lcd ? pal.segment : pal.ink));
    return { cols, rows, coverage: on / (cols * rows) };
}
/** Renders an image into dots. The canvas size is the output size. */
export function renderHalftone(canvas, source, o = {}) {
    const P = (o.pitch ?? readDotTokens(canvas).pitch) * scaleOf(canvas, o.scale);
    const cols = Math.floor(canvas.width / P), rows = Math.floor(canvas.height / P);
    const tone = sampleTone(source, cols, rows, o);
    return drawTone(canvas, tone, cols, rows, o);
}
/** Loads an image URL (same origin or CORS-enabled) and resolves when decoded. */
export function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`sekund-dots: could not load ${src}`));
        img.src = src;
    });
}
// The two large landforms only breathe (phase wobbles by ±0.35 rad); the two small
// ones travel one cycle per loop. That keeps the near rows slow and the loop exact.
function wave(u, v, th, seed) {
    const s = seed * 1.618;
    const b = 0.35 * Math.sin(th);
    const h = 0.42 * Math.sin(2 * Math.PI * (0.9 * u + 0.35 * v) + b + s) +
        0.28 * Math.sin(2 * Math.PI * (1.7 * u - 0.8 * v) - b + 1.3 + s) +
        0.2 * Math.sin(2 * Math.PI * (0.5 * u + 1.6 * v) + th + 2.1 - s) +
        0.1 * Math.sin(2 * Math.PI * (3.1 * u + 2.2 * v) - th + 0.4);
    return 0.5 + 0.5 * h;
}
export function createDotField(canvas, opts = {}) {
    const variant = opts.variant ?? "terrain";
    const lcd = opts.surface === "lcd";
    const pal = readPalette(canvas);
    const tk = readDotTokens(canvas);
    const loader = variant === "loader";
    const period = Math.max(loader ? 1.2 : 6, opts.period ?? (loader ? tk.loaderPeriod : tk.period));
    const fps = Math.max(1, Math.min(lcd ? 10 : 30, (opts.fps ?? (loader ? tk.loaderFps : tk.fps)) || 1));
    const pitchCss = opts.pitch ?? (variant === "terrain" ? tk.pitchTerrain : variant === "field" ? tk.pitch : tk.pitchFine);
    const shape = opts.shape ?? (lcd ? "square" : "round");
    const color = opts.color ?? (lcd ? pal.segment : pal.ink);
    const ghost = opts.ghost !== undefined ? opts.ghost : lcd ? pal.ghost : loader ? pal.rule : null;
    const background = opts.background !== undefined ? opts.background : lcd ? pal.lcd : pal.paper;
    const seed = opts.seed ?? 0;
    const ctx = ctx2d(canvas);
    const paint = (t) => {
        const s = scaleOf(canvas, opts.scale);
        const P = pitchCss * s;
        const W = canvas.width, H = canvas.height;
        const th = (2 * Math.PI * (((t % period) + period) % period)) / period;
        if (variant === "field") {
            const cols = Math.floor(W / P), rows = Math.floor(H / P);
            const tone = new Float32Array(cols * rows);
            for (let y = 0; y < rows; y++)
                for (let x = 0; x < cols; x++) {
                    const h = wave(x / cols, y / rows, th, seed);
                    tone[y * cols + x] = Math.max(0, Math.min(1, (h - 0.3) * 1.25));
                }
            drawTone(canvas, tone, cols, rows, { mode: "halftone", surface: opts.surface, pitch: pitchCss, scale: s, color, background, shape });
            return;
        }
        paintBackground(ctx, W, H, background);
        if (loader) {
            // Sharp attack, slow decay, one column after another (after the dot/matrix loaders).
            const n = 5;
            const cell = Math.min(W, H) / n;
            const ox = (W - cell * n) / 2, oy = (H - cell * n) / 2;
            const lit = batch(shape), off = batch(shape);
            const phase = th / (2 * Math.PI);
            for (let x = 0; x < n; x++) {
                const local = (phase - x / (n + 2) + 1) % 1;
                const env = local < 0.06 ? local / 0.06 : Math.max(0, 1 - (local - 0.06) / 0.4);
                const q = Math.round(env * 3) / 3;
                for (let y = 0; y < n; y++) {
                    const cx = ox + (x + 0.5) * cell, cy = oy + (y + 0.5) * cell;
                    const on = lcd ? q >= 0.5 : q > 0;
                    if (on)
                        lit.add(cx, cy, cell * (lcd ? tk.sizeLcd * 0.75 : 0.35 + 0.4 * q));
                    else if (ghost)
                        off.add(cx, cy, cell * (lcd ? tk.sizeLcd * 0.75 : 0.5));
                }
            }
            if (ghost)
                off.fill(ctx, ghost);
            lit.fill(ctx, color);
            return;
        }
        // Terrain: a ground grid seen in perspective, heights from the looping wave.
        // Rows are spaced evenly in 1/z, so flat ground is even on screen and slopes
        // facing the camera bunch rows into ridges. Far rows thin out by Bayer dropout.
        const amp = opts.amplitude ?? 0.6;
        const horizon = H * (opts.horizon ?? 0.32);
        const zNear = 1, zFar = 9, camH = 1;
        const f = (H - horizon) * 1.04 / (camH - amp * 0.5);
        const rows = Math.max(12, Math.round((H - horizon) / (P * 0.8)));
        const dx = (P * zNear) / f;
        const b = batch(shape);
        const gb = ghost ? batch(shape) : null;
        for (let r = 0; r < rows; r++) {
            const k = r / (rows - 1); // 0 = far, 1 = near
            const z = 1 / (1 / zFar + k * (1 / zNear - 1 / zFar));
            const near = (zFar - z) / (zFar - zNear);
            const reach = Math.ceil(((W / 2 + P) * z) / f / dx);
            for (let c = -reach; c <= reach; c++) {
                const xw = c * dx;
                const h = wave(xw * 0.55, z * 0.16, th, seed);
                const sx = W / 2 + (xw / z) * f;
                const sy = horizon + (f * (camH - amp * h)) / z;
                if (sy > H + P)
                    continue;
                const keep = (0.22 + 0.78 * near) * (0.35 + 0.95 * h);
                const d = lcd ? P * tk.sizeLcd * Math.pow(zNear / z, 0.55) : P * Math.min(0.95, (0.28 + 0.62 * h) * Math.pow(zNear / z, 0.55));
                if (keep > bayer(c, r))
                    b.add(sx, sy, d);
                else if (gb)
                    gb.add(sx, sy, lcd ? d : P * 0.2);
            }
        }
        if (gb && ghost)
            gb.fill(ctx, ghost);
        b.fill(ctx, color);
    };
    const mq = typeof matchMedia !== "undefined" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    const still = () => opts.reducedMotion === true || (opts.reducedMotion !== false && !!mq?.matches);
    const stillAt = opts.stillAt ?? period * 0.35;
    let raf = 0, running = false, wanted = false, visible = true, last = -1, elapsed = 0;
    const frameMs = 1000 / fps;
    const tick = (now) => {
        if (!running)
            return;
        if (last < 0 || now - last >= frameMs - 1) {
            if (last >= 0)
                elapsed += Math.min(now - last, 250);
            last = now;
            paint((elapsed / 1000) % period);
        }
        raf = requestAnimationFrame(tick);
    };
    const run = () => {
        if (running || still() || !visible || document.hidden)
            return;
        running = true;
        last = -1;
        raf = requestAnimationFrame(tick);
    };
    const halt = () => {
        running = false;
        cancelAnimationFrame(raf);
    };
    const onVis = () => (document.hidden ? halt() : wanted && run());
    const onMotion = () => {
        if (still()) {
            halt();
            paint(stillAt);
        }
        else if (wanted)
            run();
    };
    const io = opts.pauseOffscreen !== false && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((es) => {
            visible = es.some((e) => e.isIntersecting);
            if (visible && wanted)
                run();
            else
                halt();
        })
        : null;
    io?.observe(canvas);
    document.addEventListener("visibilitychange", onVis);
    mq?.addEventListener("change", onMotion);
    paint(still() ? stillAt : 0);
    return {
        start() { wanted = true; if (still())
            paint(stillAt);
        else
            run(); },
        stop() { wanted = false; halt(); },
        renderAt: paint,
        get running() { return running; },
        period,
        destroy() {
            wanted = false;
            halt();
            io?.disconnect();
            document.removeEventListener("visibilitychange", onVis);
            mq?.removeEventListener("change", onMotion);
        },
    };
}
