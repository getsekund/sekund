export type Mode = "show" | "notes" | "print" | "sheet" | "logos" | "illustrations";

/**
 * `?notes`, `?print` and `?sheet` pick a view; `?logos` and `?illustrations` are the brand
 * option sheets. Anything else is the audience show.
 */
export function modeFrom(search: string): Mode {
  const params = new URLSearchParams(search);
  if (params.has("notes")) return "notes";
  if (params.has("print")) return "print";
  if (params.has("sheet")) return "sheet";
  if (params.has("logos")) return "logos";
  if (params.has("illustrations")) return "illustrations";
  return "show";
}

/**
 * The hash names the slide: `#proof` by id, or `#3` by one-based number. Unknown or empty
 * hashes open the first slide.
 */
export function indexFromHash(hash: string, ids: readonly string[]): number {
  const raw = decodeURIComponent(hash.replace(/^#\/?/, "")).trim().toLowerCase();
  if (!raw) return 0;
  const byId = ids.indexOf(raw);
  if (byId >= 0) return byId;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n >= 1 && n <= ids.length) return n - 1;
  }
  return 0;
}

export function hashFor(index: number, ids: readonly string[]): string {
  return `#${ids[Math.min(Math.max(index, 0), ids.length - 1)] ?? ""}`;
}

export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}
