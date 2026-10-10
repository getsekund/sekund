import path from "node:path";
import type { WebpackOverrideFn } from "@remotion/bundler";

/**
 * The video imports the deck's own source. Its `@/` imports point into `deck/src`, and its
 * stylesheet's root URLs (`url("/fonts/…")`) resolve against `deck/public`, so the fonts are
 * bundled from the same files the deck serves. `videoRoot` is this package's directory.
 */
export function deckWebpackOverride(videoRoot: string): WebpackOverrideFn {
  const deck = path.resolve(videoRoot, "../deck");
  return (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      alias: { ...config.resolve?.alias, "@": path.join(deck, "src") },
      roots: [path.join(deck, "public"), ...(config.resolve?.roots ?? [])],
    },
  });
}
