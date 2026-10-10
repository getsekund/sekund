/** A drawn SEKUND wordmark: one SVG path, polygons only, fill-rule evenodd. */
export interface WordmarkSpec {
  id: string;
  /** Letter used on the option sheet (A, B, C, D). */
  label: string;
  name: string;
  /** One line on what the direction is for. */
  note: string;
  viewBox: string;
  width: number;
  height: number;
  path: string;
}
