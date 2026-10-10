let base = "";

/**
 * Where the deck's `public/` folder is served. The deck serves it at the root; the Remotion
 * video serves the same files under its own static prefix and sets that here before rendering.
 */
export function setAssetBase(next: string): void {
  base = next.replace(/\/+$/, "");
}

/** A file in the deck's `public/` folder, given by its root path ("/assets/lcd-approve.png"). */
export function asset(path: string): string {
  return `${base}${path}`;
}
