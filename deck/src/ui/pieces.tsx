import { asset } from "@/asset";

/** A screenshot in a hairline frame with an optional one-line caption. `src` is a path in `public/`. */
export function Shot({ src, alt, width, height, caption }: { src: string; alt: string; width: number; height: number; caption?: string }) {
  return (
    <figure className="frame" style={{ width, margin: 0 }}>
      <div className="frame__img" style={{ width, height }}>
        <img src={asset(src)} alt={alt} width={width} height={height} />
      </div>
      {caption && <figcaption className="caption">{caption}</figcaption>}
    </figure>
  );
}

/** One numbered step on the how-it-works slide: LCD number, a drawn figure, title, an optional line. */
export function Step({ n, title, detail, figure }: { n: string; title: string; detail?: string; figure: React.ReactNode }) {
  return (
    <div className="step">
      <span className="step__n">{n}</span>
      <div className="step__img">{figure}</div>
      <h3 className="sub">{title}</h3>
      {detail && <p className="step__d">{detail}</p>}
    </div>
  );
}
