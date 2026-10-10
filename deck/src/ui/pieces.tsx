/** A screenshot in a hairline frame with an optional one-line caption. */
export function Shot({ src, alt, width, height, caption }: { src: string; alt: string; width: number; height: number; caption?: string }) {
  return (
    <figure className="frame" style={{ width, margin: 0 }}>
      <div className="frame__img" style={{ width, height }}>
        <img src={src} alt={alt} width={width} height={height} />
      </div>
      {caption && <figcaption className="caption">{caption}</figcaption>}
    </figure>
  );
}

/** One numbered step on the how-it-works slide: LCD number, picture, title, one line. */
export function Step({
  n,
  title,
  detail,
  src,
  alt,
  fit = "cover",
  background,
}: {
  n: string;
  title: string;
  detail: string;
  src: string;
  alt: string;
  fit?: "cover" | "contain";
  background?: string;
}) {
  return (
    <div className="step">
      <span className="step__n">{n}</span>
      <div className="frame__img" style={{ width: "100%", aspectRatio: "724 / 560", background }}>
        <img src={src} alt={alt} style={{ objectPosition: fit === "cover" ? "top" : "center", objectFit: fit }} />
      </div>
      <h3 className="step__t">{title}</h3>
      <p className="step__d">{detail}</p>
    </div>
  );
}
