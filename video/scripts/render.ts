/**
 * Renders the pitch video and its poster frame.
 *
 *   pnpm --filter @sekund/video render                 # MP4 + poster into video/out/
 *   pnpm --filter @sekund/video render --no-captions   # the same without burned-in captions
 *   pnpm --filter @sekund/video render --stills 0,140,1500   # review stills only (frames)
 *   pnpm --filter @sekund/video render --copy-to <dir> # also copy the MP4 and poster there
 *
 * With public/vo.mp3 present the cut carries Goran's voice-over; without it the cut is silent.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { cpus } from "node:os";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { VO_FILE } from "../src/script";
import { webpackOverride } from "../webpack-override";

const root = resolve(import.meta.dirname, "..");
const { values } = parseArgs({
  options: {
    "no-captions": { type: "boolean", default: false },
    stills: { type: "string" },
    "copy-to": { type: "string" },
    out: { type: "string", default: resolve(root, "out") },
  },
});

const captions = !values["no-captions"];
const vo = existsSync(resolve(root, "public", VO_FILE));
const name = `sekund-pitch-2min${captions ? "-captions" : ""}${vo ? "-vo" : ""}`;
const outDir = values.out;
mkdirSync(outDir, { recursive: true });

console.log("bundling");
const serveUrl = await bundle({ entryPoint: resolve(root, "src/index.ts"), webpackOverride, publicDir: resolve(root, "public") });
const inputProps = { captions };
const composition = await selectComposition({ serveUrl, id: "SekundPitch", inputProps });

if (values.stills) {
  for (const frame of values.stills.split(",").map(Number)) {
    const output = resolve(outDir, "frames", `${String(frame).padStart(4, "0")}.png`);
    await renderStill({ composition, serveUrl, inputProps, frame, output, overwrite: true });
    console.log("still", output);
  }
  process.exit(0);
}

const video = resolve(outDir, `${name}.mp4`);
let last = -1;
await renderMedia({
  composition,
  serveUrl,
  inputProps,
  codec: "h264",
  crf: 18,
  pixelFormat: "yuv420p",
  muted: !vo,
  outputLocation: video,
  concurrency: Math.max(1, cpus().length - 1),
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 100);
    if (pct % 5 === 0 && pct !== last) console.log(`render ${pct}%`);
    last = pct;
  },
});
console.log("video", video);

// The poster is the title beat once the hero has dissolved in and before the first caption ends.
const poster = resolve(outDir, `${name}-poster.png`);
await renderStill({ composition, serveUrl, inputProps: { captions: false }, frame: Math.round(4.6 * composition.fps), output: poster, overwrite: true });
console.log("poster", poster);

if (values["copy-to"]) {
  mkdirSync(values["copy-to"], { recursive: true });
  for (const file of [video, poster]) {
    const target = resolve(values["copy-to"], file.split("/").pop()!);
    copyFileSync(file, target);
    console.log("copied", target);
  }
}
