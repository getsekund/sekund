import { WORDMARK, type WordmarkSpec } from "@/brand";

/** The SEKUND wordmark. Drawn, never set in a font. Defaults to the brand's live option. */
export function Wordmark({ width = 240, spec = WORDMARK, className, style }: { width?: number; spec?: WordmarkSpec; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox={spec.viewBox} width={width} height={(width * spec.height) / spec.width} className={className} style={style} role="img" aria-label="SEKUND">
      <path d={spec.path} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
