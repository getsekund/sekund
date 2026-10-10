import { threshold } from "@/dither/bayer";
import { usePalette, type DitherPalette } from "@/dither/palette";
import { GLCD } from "@/ui/glcdfont";

/**
 * The four how-it-works pictures, drawn rather than captured. Everything is vector in one
 * 724 × 540 box (the same aspect the step cards had for screenshots): device outlines in ink,
 * byte strips as ordered-dither cells in the live palette, labels in the watch's 5×7 dots,
 * and a schematic LCD panel in the deck's LCD tint. No product screenshot is used.
 */
export const DIAGRAM_W = 724;
export const DIAGRAM_H = 540;

const INK = "var(--d-ink)";
const DIM = "var(--d-dim)";
const RULE = "var(--d-rule)";
const LCD = "var(--d-lcd)";
const SEG = "var(--d-segment)";
const GROUND = "var(--d-ground)";

/** One SVG path of 5×7 dot-matrix glyphs, in box units; `dot` is the size of one dot. */
function dots(text: string, x: number, y: number, dot: number): string {
  const out: string[] = [];
  [...text.toUpperCase()].forEach((ch, index) => {
    const glyph = GLCD[ch] ?? GLCD["?"] ?? [0, 0, 0, 0, 0];
    glyph.forEach((column, cx) => {
      for (let row = 0; row < 8; row++) {
        if (column & (1 << row)) out.push(`M${x + (index * 6 + cx) * dot},${y + row * dot}h${dot}v${dot}h-${dot}z`);
      }
    });
  });
  return out.join("");
}

/** Width of a dot-matrix label in box units. */
function dotsWidth(text: string, dot: number): number {
  return Math.max(0, text.length * 6 - 1) * dot;
}

function Label({ text, x, y, dot, color = INK }: { text: string; x: number; y: number; dot: number; color?: string }) {
  return <path d={dots(text, x, y, dot)} fill={color} />;
}

/**
 * A strip of byte cells. Every cell is drawn; the ones the ordered dither lights are ink or the
 * palette blue (the same rule as the fields), the rest are the hairline grey, so the strip reads
 * as a run of bytes rather than as noise. `solid` marks the cells a step singles out.
 */
function Bytes({
  x,
  y,
  cols,
  rows,
  cell = 14,
  gap = 3,
  coverage,
  solid,
  palette,
}: {
  x: number;
  y: number;
  cols: number;
  rows: number;
  cell?: number;
  gap?: number;
  coverage: (c: number, r: number) => number;
  solid?: (c: number, r: number) => boolean;
  palette: DitherPalette;
}) {
  const off: string[] = [];
  const white: string[] = [];
  const blue: string[] = [];
  const pitch = cell + gap;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = `M${x + c * pitch},${y + r * pitch}h${cell}v${cell}h-${cell}z`;
      if (solid?.(c, r)) {
        white.push(d);
        continue;
      }
      const cov = coverage(c, r);
      const th = threshold(c, r);
      if (cov > th) (palette.mix > 0 && th < cov * palette.mix ? blue : white).push(d);
      else off.push(d);
    }
  }
  return (
    <g>
      <path d={off.join("")} fill={RULE} />
      <path d={white.join("")} fill={INK} />
      <path d={blue.join("")} fill={palette.blue} />
    </g>
  );
}

/** The width a `Bytes` strip takes. */
function bytesWidth(cols: number, cell = 14, gap = 3): number {
  return cols * (cell + gap) - gap;
}

const wave = (c: number, r: number): number => 0.42 + 0.26 * Math.sin(c * 0.73 + r * 1.31);

function Phone({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={26} fill={GROUND} stroke={INK} strokeWidth={4} />
      <line x1={x + width / 2 - 24} y1={y + 22} x2={x + width / 2 + 24} y2={y + 22} stroke={DIM} strokeWidth={4} strokeLinecap="round" />
      <line x1={x + width / 2 - 30} y1={y + height - 20} x2={x + width / 2 + 30} y2={y + height - 20} stroke={DIM} strokeWidth={4} strokeLinecap="round" />
    </g>
  );
}

/** A watch case with four pushers and a lit LCD panel. `press` fills one pusher with the palette blue. */
function Watch({
  x,
  y,
  width,
  height,
  inset = 28,
  press,
  palette,
  children,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  inset?: number;
  press?: "A" | "B" | "C" | "D";
  palette: DitherPalette;
  children?: React.ReactNode;
}) {
  const pw = 12;
  const ph = 26;
  const pushers: { id: "A" | "B" | "C" | "D"; px: number; py: number }[] = [
    { id: "A", px: x - pw, py: y + height * 0.32 - ph / 2 },
    { id: "B", px: x - pw, py: y + height * 0.68 - ph / 2 },
    { id: "C", px: x + width, py: y + height * 0.32 - ph / 2 },
    { id: "D", px: x + width, py: y + height * 0.68 - ph / 2 },
  ];
  return (
    <g>
      {pushers.map((p) => (
        <rect key={p.id} x={p.px} y={p.py} width={pw} height={ph} fill={press === p.id ? palette.blue : RULE} stroke={INK} strokeWidth={3} />
      ))}
      <rect x={x} y={y} width={width} height={height} rx={22} fill={GROUND} stroke={INK} strokeWidth={4} />
      <rect x={x + inset} y={y + inset * 1.5} width={width - inset * 2} height={height - inset * 3} rx={6} fill={LCD} />
      {children}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = 18;
  const hx1 = x2 - h * Math.cos(a - 0.6);
  const hy1 = y2 - h * Math.sin(a - 0.6);
  const hx2 = x2 - h * Math.cos(a + 0.6);
  const hy2 = y2 - h * Math.sin(a + 0.6);
  return (
    <g stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polyline points={`${hx1},${hy1} ${x2},${y2} ${hx2},${hy2}`} />
    </g>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${DIAGRAM_W} ${DIAGRAM_H}`} width="100%" height="100%" role="img" aria-label={title}>
      <title>{title}</title>
      {children}
    </svg>
  );
}

/** 1 · The companion builds the transaction and sends the exact message bytes to the watch. */
export function BuildDiagram() {
  const palette = usePalette();
  const strip = { x: 262, y: 246, cols: 12, rows: 3 };
  const stripEnd = strip.x + bytesWidth(strip.cols);
  return (
    <Box title="The companion app sends the exact message bytes to the watch">
      <Phone x={40} y={50} width={190} height={440} />
      <line x1={70} y1={110} x2={200} y2={110} stroke={DIM} strokeWidth={3} />
      <line x1={70} y1={142} x2={200} y2={142} stroke={DIM} strokeWidth={3} />
      <line x1={70} y1={174} x2={150} y2={174} stroke={DIM} strokeWidth={3} />
      <Bytes x={70} y={226} cols={8} rows={12} coverage={wave} palette={palette} />
      <Bytes {...strip} coverage={wave} palette={palette} />
      <polyline points={`${stripEnd + 6},${strip.y - 2} ${stripEnd + 28},${strip.y + 24} ${stripEnd + 6},${strip.y + 50}`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Label text="EXACT" x={364 - dotsWidth("EXACT", 6) / 2} y={318} dot={6} />
      <Label text="BYTES" x={364 - dotsWidth("BYTES", 6) / 2} y={372} dot={6} />
      <Watch x={506} y={140} width={186} height={260} palette={palette} />
    </Box>
  );
}

/** 2 · The watch parses amount and destination out of the bytes it will sign. */
export function ParseDiagram() {
  const palette = usePalette();
  const strip = { x: 40, y: 46, cols: 38, rows: 2 };
  const pitch = 17;
  const amount = { from: 6, to: 13 };
  const dest = { from: 18, to: 35 };
  const span = (s: { from: number; to: number }) => ({ x1: strip.x + s.from * pitch, x2: strip.x + (s.to + 1) * pitch - 3 });
  const a = span(amount);
  const d = span(dest);
  const stripBottom = strip.y + 2 * pitch - 3;
  const bracketY = stripBottom + 18;
  const panel = { x: 162, y: 196, w: 400, h: 300 };
  return (
    <Box title="The watch reads amount and destination from the bytes it signs">
      <Bytes {...strip} coverage={wave} solid={(c) => (c >= amount.from && c <= amount.to) || (c >= dest.from && c <= dest.to)} palette={palette} />
      <g stroke={INK} strokeWidth={3} fill="none" strokeLinecap="square">
        <polyline points={`${a.x1},${bracketY - 10} ${a.x1},${bracketY} ${a.x2},${bracketY} ${a.x2},${bracketY - 10}`} />
        <polyline points={`${d.x1},${bracketY - 10} ${d.x1},${bracketY} ${d.x2},${bracketY} ${d.x2},${bracketY - 10}`} />
      </g>
      <g stroke={DIM} strokeWidth={3} strokeDasharray="6 8" strokeLinecap="round">
        <line x1={(a.x1 + a.x2) / 2} y1={bracketY + 4} x2={(a.x1 + a.x2) / 2} y2={panel.y - 6} />
        <line x1={(d.x1 + d.x2) / 2} y1={bracketY + 4} x2={(d.x1 + d.x2) / 2} y2={panel.y - 6} />
      </g>
      <rect x={panel.x} y={panel.y} width={panel.w} height={panel.h} rx={10} fill={LCD} />
      <Label text="AMOUNT" x={panel.x + 30} y={panel.y + 28} dot={4} color={SEG} />
      <text x={panel.x + 28} y={panel.y + 136} className="lcd" fontSize={78} fill={SEG}>
        0.01
      </text>
      <Label text="SOL" x={panel.x + 262} y={panel.y + 96} dot={6} color={SEG} />
      <line x1={panel.x + 30} y1={panel.y + 168} x2={panel.x + panel.w - 30} y2={panel.y + 168} stroke={SEG} strokeWidth={2} opacity={0.35} />
      <Label text="TO" x={panel.x + 30} y={panel.y + 190} dot={4} color={SEG} />
      <Label text="5AWD..UABG" x={panel.x + 30} y={panel.y + 230} dot={6} color={SEG} />
    </Box>
  );
}

/** 3 · A PIN opens the session; approving is a separate press on the watch. */
export function ApproveDiagram() {
  const palette = usePalette();
  const left = { x: 28, y: 120, w: 300, h: 300 };
  const right = { x: 396, y: 120, w: 300, h: 300 };
  const lcdX = (w: { x: number }) => w.x + 28;
  const lcdY = left.y + 42;
  const squares = [0, 1, 2, 3];
  return (
    <Box title="A PIN opens the session; approve is a separate button press">
      <Watch x={left.x} y={left.y} width={left.w} height={left.h} palette={palette}>
        <Label text="PIN" x={lcdX(left) + 22} y={lcdY + 26} dot={7} color={SEG} />
        {squares.map((i) => (
          <rect key={i} x={lcdX(left) + 22 + i * 52} y={lcdY + 112} width={30} height={30} fill={SEG} />
        ))}
      </Watch>
      <Arrow x1={344} y1={270} x2={380} y2={270} />
      <Watch x={right.x} y={right.y} width={right.w} height={right.h} press="D" palette={palette}>
        <Label text="APPROVE?" x={lcdX(right) + 4} y={lcdY + 26} dot={5} color={SEG} />
        <Label text="REJECT" x={lcdX(right) + 4} y={lcdY + 150} dot={3} color={SEG} />
        <Label text="APPROVE" x={lcdX(right) + 244 - 4 - dotsWidth("APPROVE", 3)} y={lcdY + 150} dot={3} color={SEG} />
      </Watch>
    </Box>
  );
}

/** 4 · The signature comes back over the same bytes; the companion verifies, assembles and broadcasts. */
export function SignDiagram() {
  const palette = usePalette();
  const sig = { x: 262, y: 200, cols: 8, rows: 8 };
  const sigW = bytesWidth(sig.cols);
  const phone = { x: 436, y: 70, w: 170, h: 400 };
  const dense = (c: number, r: number): number => 0.55 + 0.2 * Math.sin(c * 1.9 + r * 0.7);
  const hub = { x: 694, y: 270 };
  const leaves = [
    { x: 656, y: 176 },
    { x: 656, y: 364 },
  ];
  return (
    <Box title="The Ed25519 signature returns; the companion verifies it, assembles the transaction and broadcasts">
      <Watch x={24} y={150} width={190} height={230} inset={22} palette={palette}>
        <Label text="SIGNED" x={24 + 22 + 3} y={150 + 33 + 52} dot={4} color={SEG} />
      </Watch>
      <Bytes {...sig} coverage={dense} palette={palette} />
      <Label text="SIGNATURE" x={sig.x + sigW / 2 - dotsWidth("SIGNATURE", 4) / 2} y={sig.y + bytesWidth(sig.rows) + 22} dot={4} />
      <Arrow x1={sig.x + sigW + 10} y1={270} x2={phone.x - 8} y2={270} />
      <Phone x={phone.x} y={phone.y} width={phone.w} height={phone.h} />
      <polyline points={`${phone.x + 38},${270} ${phone.x + 74},${306} ${phone.x + 134},${228}`} fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      <Arrow x1={phone.x + phone.w + 8} y1={270} x2={hub.x - 14} y2={270} />
      <g stroke={DIM} strokeWidth={3}>
        {leaves.map((n, i) => (
          <line key={i} x1={hub.x} y1={hub.y} x2={n.x} y2={n.y} />
        ))}
      </g>
      {[hub, ...leaves].map((n, i) => (
        <rect key={i} x={n.x - 9} y={n.y - 9} width={18} height={18} fill={palette.blue} />
      ))}
    </Box>
  );
}
