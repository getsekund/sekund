/**
 * SEKUND dots: ordered-dither halftone and a slow dot field, on Canvas 2D.
 * No dependencies. Spec: docs/brand/DESIGN.md, section 10.
 */
export type DotShape = "round" | "square";
/** "paper": round Ink dots that may vary in size. "lcd": square Segment dots, on or off, never sized. */
export type DotSurface = "paper" | "lcd";
export interface DotPalette {
    ink: string;
    paper: string;
    rule: string;
    lcd: string;
    segment: string;
    ghost: string;
}
export interface DotTokens {
    pitchFine: number;
    pitch: number;
    pitchTerrain: number;
    pitchTitle: number;
    size: number;
    sizeMax: number;
    sizeLcd: number;
    levels: number;
    period: number;
    fps: number;
    loaderPeriod: number;
    loaderFps: number;
}
/** 8×8 Bayer index matrix, row-major. Threshold for cell (x, y) is (B + 0.5) / 64. */
export declare const BAYER8: readonly number[];
export declare function bayer(x: number, y: number): number;
/** Reads the --sk-* color tokens, falling back to the DESIGN.md values. */
export declare function readPalette(el?: Element): DotPalette;
/** Reads the --sk-dot-* tokens. Pitches in CSS px, periods in seconds. */
export declare function readDotTokens(el?: Element): DotTokens;
/** Sizes the canvas backing store to its CSS box times devicePixelRatio. Returns the scale. */
export declare function fitCanvas(canvas: HTMLCanvasElement, cssWidth?: number, cssHeight?: number): number;
export interface HalftoneOptions {
    /** "dither": every dot is the same size, on or off (1-bit). "halftone": dot area follows tone in `levels` steps, ordered-dithered between steps. Forced to "dither" on LCD. */
    mode?: "dither" | "halftone";
    surface?: DotSurface;
    /** Grid pitch in CSS px. Default --sk-dot-pitch (6). */
    pitch?: number;
    /** Dither dot diameter as a share of pitch. Default --sk-dot-size (0.78), or --sk-dot-size-lcd (0.8) on LCD. */
    dot?: number;
    /** Halftone: largest dot diameter as a share of pitch. Default --sk-dot-size-max (0.9). */
    maxDot?: number;
    /** Halftone: number of dot sizes above zero. Default --sk-dot-levels (4). */
    levels?: number;
    /** Default round on paper, square on LCD. */
    shape?: DotShape;
    /** Default Ink on paper, Segment on LCD. */
    color?: string;
    /** Background fill, or null for transparent. Default Paper, or LCD on LCD. */
    background?: string | null;
    /** Luminance mapped to full ink. Default 0.06. */
    black?: number;
    /** Luminance mapped to bare paper. Default 0.86. */
    white?: number;
    /** Tone curve exponent applied to darkness. Above 1 lightens mid-tones. Default 1. */
    gamma?: number;
    fit?: "contain" | "cover";
    /** Pixel scale (device px per CSS px). Default: canvas.width / clientWidth, or 1. */
    scale?: number;
}
export interface HalftoneResult {
    cols: number;
    rows: number;
    /** Share of cells with a dot, 0..1. Ink area is lower; see DESIGN.md 10.6 for the coverage limit. */
    coverage: number;
}
/** Darkness 0..1 per cell, from an image drawn into a cols × rows buffer (area-averaged by the browser). */
export declare function sampleTone(source: CanvasImageSource, cols: number, rows: number, o?: Pick<HalftoneOptions, "black" | "white" | "gamma" | "fit">): Float32Array;
/**
 * Hard-edged coverage per cell (0 or 1) for shapes such as the wordmark. `rect` is in cells.
 * Supersampled `ss` × `ss` and thresholded so letter edges stay crisp instead of fuzzy.
 */
export declare function maskTone(source: CanvasImageSource, cols: number, rows: number, rect: {
    x: number;
    y: number;
    w: number;
    h: number;
}, threshold?: number, ss?: number): Float32Array;
/** Draws a tone field (darkness per cell) as dots, centered on the canvas. Shared by images and the dot field. */
export declare function drawTone(canvas: HTMLCanvasElement, tone: Float32Array, cols: number, rows: number, o?: HalftoneOptions): HalftoneResult;
/** Renders an image into dots. The canvas size is the output size. */
export declare function renderHalftone(canvas: HTMLCanvasElement, source: CanvasImageSource, o?: HalftoneOptions): HalftoneResult;
/** Loads an image URL (same origin or CORS-enabled) and resolves when decoded. */
export declare function loadImage(src: string): Promise<HTMLImageElement>;
export interface DotFieldOptions {
    /** "terrain": a dot landscape in perspective (hero, title cards, video). "field": flat halftone swells (section dividers, deck). "loader": 5×5 column scan (waiting). */
    variant?: "terrain" | "field" | "loader";
    /** "lcd" draws square Segment dots on LCD with Ghosts, on or off only, at 10 fps or less. */
    surface?: DotSurface;
    /** Grid pitch in CSS px. Defaults: terrain --sk-dot-pitch-terrain (8), field --sk-dot-pitch (6), loader --sk-dot-pitch-fine (4, per cell gap). */
    pitch?: number;
    /** Loop length in seconds. Minimum 6 for terrain and field, 1.2 for loader. Defaults --sk-dot-period (8) and --sk-dot-loader-period (2.4). */
    period?: number;
    /** Frame cap. Defaults --sk-dot-fps (24) and --sk-dot-loader-fps (10). Never above 30, or 10 on LCD. */
    fps?: number;
    shape?: DotShape;
    color?: string;
    /** Unlit dot color, or null to skip them. Default: Ghost on LCD, Rule for the paper loader, none otherwise. */
    ghost?: string | null;
    background?: string | null;
    /** Terrain: hill height as a share of camera height, 0..0.9. Default 0.6. */
    amplitude?: number;
    /** Terrain: horizon as a share of canvas height. Text goes above it. Default 0.32. */
    horizon?: number;
    /** Shifts the wave phases so two fields never match. Default 0. */
    seed?: number;
    /** "auto" follows prefers-reduced-motion. true forces the still frame. */
    reducedMotion?: "auto" | boolean;
    /** Time in seconds of the still frame used for reduced motion. Default 0.35 × period. */
    stillAt?: number;
    /** Pause when scrolled out of view. Default true. */
    pauseOffscreen?: boolean;
    scale?: number;
}
export interface DotField {
    start(): void;
    stop(): void;
    /** Draws the frame for time t (seconds). Deterministic; t and t + period are identical. */
    renderAt(t: number): void;
    readonly running: boolean;
    readonly period: number;
    destroy(): void;
}
export declare function createDotField(canvas: HTMLCanvasElement, opts?: DotFieldOptions): DotField;
