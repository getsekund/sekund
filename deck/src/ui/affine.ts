type Point = readonly [number, number];

/**
 * Least-squares affine map from `src` to `dst` (same length, at least three points), as the six
 * numbers of a CSS `matrix(a, b, c, d, e, f)`. Enough for a panel photographed nearly square on:
 * the perspective left over is well under a pixel at slide size.
 */
export function fitAffine(src: readonly Point[], dst: readonly Point[]): string {
  let suu = 0;
  let suv = 0;
  let svv = 0;
  let su = 0;
  let sv = 0;
  let rxu = 0;
  let rxv = 0;
  let rx1 = 0;
  let ryu = 0;
  let ryv = 0;
  let ry1 = 0;
  const n = src.length;
  src.forEach(([u, v], i) => {
    const [px, py] = dst[i] ?? [0, 0];
    suu += u * u;
    suv += u * v;
    svv += v * v;
    su += u;
    sv += v;
    rxu += u * px;
    rxv += v * px;
    rx1 += px;
    ryu += u * py;
    ryv += v * py;
    ry1 += py;
  });
  // Normal equations, one 3x3 system per output axis, by Cramer's rule.
  const det = (m00: number, m01: number, m02: number, m10: number, m11: number, m12: number, m20: number, m21: number, m22: number) =>
    m00 * (m11 * m22 - m12 * m21) - m01 * (m10 * m22 - m12 * m20) + m02 * (m10 * m21 - m11 * m20);
  const d = det(suu, suv, su, suv, svv, sv, su, sv, n);
  const solve = (r0: number, r1: number, r2: number): [number, number, number] => [
    det(r0, suv, su, r1, svv, sv, r2, sv, n) / d,
    det(suu, r0, su, suv, r1, sv, su, r2, n) / d,
    det(suu, suv, r0, suv, svv, r1, su, sv, r2) / d,
  ];
  const [a, c, e] = solve(rxu, rxv, rx1);
  const [b, dd, f] = solve(ryu, ryv, ry1);
  return `matrix(${[a, b, c, dd, e, f].map((v) => v.toFixed(5)).join(", ")})`;
}
