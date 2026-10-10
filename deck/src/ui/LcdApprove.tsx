import { GLCD } from "@/ui/glcdfont";

/**
 * The watch simulator's LCD page, redrawn as vector so it stays crisp at any size. The geometry is
 * the simulator's own (watch-sim/src/face/Watch.tsx and strip.ts): the 220 × 236 window, the
 * 14-segment top line at 21 units, the 7-segment digits at 46 and 22, the 2 × 16 dot strip at a
 * 2-unit pitch, the four annunciator triangles. Only the panel fill is left out: the page is laid
 * over a panel that already exists in the picture underneath, and the ghosts are translucent so
 * they take that panel's shading.
 */
const LCD_WINDOW = { x: 70, y: 116, w: 220, h: 236 };

const STRIP_CHARS = 16;
const STRIP_LINES = 2;
const GLYPH_W = 5;
const GLYPH_H = 7;
const CELL_W = GLYPH_W + 1;
const CELL_H = GLYPH_H + 2;

const LIT = "var(--d-segment)";
/** Unlit segments: a shade on whatever panel sits underneath, as the simulator's ghost tint is on its flat panel. */
const GHOST = "rgba(0, 0, 0, 0.07)";

function cell(col: number, row: number, pitch: number, dot: number): string {
  const s = dot.toFixed(2);
  return `M${(col * pitch).toFixed(2)} ${(row * pitch).toFixed(2)}h${s}v${s}h-${s}z`;
}

function stripGhost(pitch: number, dot: number): string {
  const out: string[] = [];
  for (let line = 0; line < STRIP_LINES; line++)
    for (let ch = 0; ch < STRIP_CHARS; ch++)
      for (let c = 0; c < GLYPH_W; c++) for (let r = 0; r < GLYPH_H; r++) out.push(cell(ch * CELL_W + c, line * CELL_H + r, pitch, dot));
  return out.join("");
}

function stripLit(lines: readonly [string, string], pitch: number, dot: number): string {
  const out: string[] = [];
  lines.forEach((line, li) => {
    const text = line.padEnd(STRIP_CHARS, " ");
    for (let ch = 0; ch < STRIP_CHARS; ch++) {
      const g = GLCD[text[ch] ?? " "] ?? GLCD["?"] ?? [];
      for (let c = 0; c < GLYPH_W; c++) {
        const bits = g[c] ?? 0;
        for (let r = 0; r < GLYPH_H; r++) if ((bits >> r) & 1) out.push(cell(ch * CELL_W + c, li * CELL_H + r, pitch, dot));
      }
    }
  });
  return out.join("");
}

const right = (text: string) => text.padStart(STRIP_CHARS, " ");

function Annunciator({ x, y, dir, on }: { x: number; y: number; dir: "r" | "l"; on: boolean }) {
  const s = 4;
  const points = dir === "r" ? `${x},${y - s} ${x + s},${y} ${x},${y + s}` : `${x},${y - s} ${x - s},${y} ${x},${y + s}`;
  return <polygon points={points} fill={on ? LIT : GHOST} />;
}

/**
 * The APPROVE? page: the last review page, with the session countdown in the digits, REJECT and
 * APPROVE on the strip, and the A, C and D annunciators lit (previous field, reject, approve).
 * `main` is in DSEG terms, `!` a blank digit, as the simulator formats it.
 */
export function ApprovePage({ main = "!0:44" }: { main?: string }) {
  const { x, y, w } = LCD_WINDOW;
  const seg14 = { fontFamily: "var(--d-font-lcd14)" } as const;
  const seg7 = { fontFamily: "var(--d-font-lcd7)" } as const;
  return (
    <g>
      <text style={seg14} x={x + 18} y={y + 44} fontSize={21} fill={GHOST}>
        ~~~~~~~~
      </text>
      <text style={seg14} x={x + 18} y={y + 44} fontSize={21} fill={LIT}>
        APPROVE?
      </text>
      <text style={seg7} x={x + 166} y={y + 128} fontSize={46} textAnchor="end" fill={GHOST}>
        88:88
      </text>
      <text style={seg7} x={x + 166} y={y + 128} fontSize={46} textAnchor="end" fill={LIT}>
        {main}
      </text>
      <text style={seg7} x={x + 208} y={y + 128} fontSize={22} textAnchor="end" fill={GHOST}>
        88
      </text>
      <g transform={`translate(${x + 15} ${y + 168})`}>
        <path d={stripGhost(2, 1.6)} fill={GHOST} />
        <path d={stripLit([right("REJECT"), right("APPROVE")], 2, 1.6)} fill={LIT} />
      </g>
      <Annunciator x={x + 5} y={y + 53} dir="r" on />
      <Annunciator x={x + 5} y={y + 193} dir="r" on={false} />
      <Annunciator x={x + w - 5} y={y + 53} dir="l" on />
      <Annunciator x={x + w - 5} y={y + 193} dir="l" on />
    </g>
  );
}
