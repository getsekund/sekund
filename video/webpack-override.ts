import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WebpackOverrideFn } from "@remotion/bundler";

const here = path.dirname(fileURLToPath(import.meta.url));
const deck = path.resolve(here, "../deck");

/**
 * The video imports the deck's own source. Its `@/` imports point into `deck/src`, and its
 * stylesheet's root URLs (`url("/fonts/…")`) resolve against `deck/public`, so the fonts are
 * bundled from the same files the deck serves.
 */
export const webpackOverride: WebpackOverrideFn = (config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: { ...config.resolve?.alias, "@": path.join(deck, "src") },
    roots: [path.join(deck, "public"), ...(config.resolve?.roots ?? [])],
  },
});
