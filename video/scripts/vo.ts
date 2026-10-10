/**
 * Takes Goran's voice-over from a folder, lines it up with the script and renders the voiced cut.
 *
 *   pnpm video:vo --dir <folder>            # once: <folder>/vo.<any audio> -> <folder>/sekund-pitch-2min-vo.mp4
 *   pnpm video:vo --dir <folder> --watch    # wait for vo.* to appear (or change), then do the same
 *   pnpm video:vo --dir <folder> --offset 3.2   # skip the alignment: the take's 0:00 is at 3.2 s
 *   pnpm video:vo --dir <folder> --captions     # burn the captions in as well (-captions-vo.mp4)
 *
 * The take can be any format ffmpeg reads (m4a from Voice Memos or QuickTime, mp3, wav, aiff, caf,
 * even a phone video). It is aligned by its speech onsets against the cue starts in src/script.ts,
 * trimmed or padded so 0:00 matches the video, loudness-normalised and written to public/vo.mp3.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { BEATS, TOTAL_SECONDS, VO_FILE, timecode } from "../src/script";
import { align, frameLevels, MATCH_S, speechSegments, type Alignment } from "./vo-align";

const root = resolve(import.meta.dirname, "..");
const AUDIO = new Set([".mp3", ".m4a", ".aac", ".wav", ".aif", ".aiff", ".caf", ".flac", ".ogg", ".opus", ".webm", ".mp4", ".mov", ".m4v", ".3gp", ".amr"]);
const SAMPLE_RATE = 16_000;
const POLL_MS = 10_000;

const { values } = parseArgs({
  options: {
    dir: { type: "string" },
    watch: { type: "boolean", default: false },
    offset: { type: "string" },
    captions: { type: "boolean", default: false },
  },
});
if (!values.dir) throw new Error("--dir <folder> is required: where vo.* is dropped and the voiced cut goes");
const dir = resolve(values.dir);
const output = `sekund-pitch-2min${values.captions ? "-captions" : ""}-vo.mp4`;
const statePath = resolve(root, "out", "vo-state.json");

interface Take {
  path: string;
  size: number;
  mtimeMs: number;
}

function findTake(): Take | null {
  if (!existsSync(dir)) return null;
  const takes = readdirSync(dir)
    .filter((name) => basename(name, extname(name)).toLowerCase() === "vo" && AUDIO.has(extname(name).toLowerCase()))
    .map((name) => {
      const path = resolve(dir, name);
      const { size, mtimeMs } = statSync(path);
      return { path, size, mtimeMs };
    })
    .filter((take) => take.size > 0)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return takes[0] ?? null;
}

const sameTake = (a: Take | null, b: Take | null) => !!a && !!b && a.path === b.path && a.size === b.size && a.mtimeMs === b.mtimeMs;

function lastDone(): Take | null {
  try {
    return JSON.parse(readFileSync(statePath, "utf8")) as Take;
  } catch {
    return null;
  }
}

function ffmpeg(args: string[], encoding: "buffer" | "utf8" = "utf8") {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", ...args], { maxBuffer: 1 << 30, encoding: encoding === "utf8" ? "utf8" : "buffer" });
  if (run.status !== 0) throw new Error(`ffmpeg ${args.join(" ")}\n${run.stderr.toString().slice(-2000)}`);
  return run;
}

function duration(path: string): number {
  const run = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], { encoding: "utf8" });
  return Number(run.stdout.trim());
}

function analyse(path: string): { alignment: Alignment; range: number; length: number } {
  const pcm = ffmpeg(["-i", path, "-vn", "-ac", "1", "-ar", String(SAMPLE_RATE), "-f", "f32le", "-"], "buffer").stdout as Buffer;
  const samples = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 4));
  const length = samples.length / SAMPLE_RATE;
  const { segments, range } = speechSegments(frameLevels(samples, SAMPLE_RATE));
  const cueStarts = BEATS.flatMap((b) => b.cues.map((c) => c.at));
  const fixed = values.offset === undefined ? null : Number(values.offset);
  const alignment = align(
    segments.map((s) => s.start),
    cueStarts,
    fixed === null ? { min: -1, max: Math.max(0, Math.min(120, length - 20)) } : { min: fixed, max: fixed },
  );
  return { alignment, range, length };
}

function report(alignment: Alignment, range: number, length: number): void {
  const cues = BEATS.flatMap((b) => b.cues);
  console.log(`take ${length.toFixed(1)} s, speech ${range.toFixed(0)} dB over the floor`);
  console.log(`offset ${alignment.offset.toFixed(2)} s: the video's 0:00 is at ${alignment.offset.toFixed(2)} s into the take`);
  console.log(`${alignment.matched} of ${cues.length} lines start within ${MATCH_S} s of their cue`);
  cues.forEach((cue, i) => {
    const drift = alignment.drift[i]!;
    if (Math.abs(drift) > 0.35) console.log(`  ${timecode(cue.at)} ${drift > 0 ? "+" : ""}${Number.isFinite(drift) ? drift.toFixed(2) : "?"} s  "${cue.text}"`);
  });
  if (range < 12) console.warn("warning: the take is quiet or noisy; check it by ear");
  if (alignment.matched < cues.length * 0.6) console.warn("warning: fewer than 60% of the lines matched their cues; check the sync, or pass --offset");
}

function convert(path: string, offset: number): string {
  const out = resolve(root, "public", VO_FILE);
  const head = offset >= 0 ? `atrim=start=${offset},asetpts=PTS-STARTPTS` : `adelay=${Math.round(-offset * 1000)}:all=1`;
  const fade = (TOTAL_SECONDS - 0.4).toFixed(2);
  const chain = [head, "highpass=f=70", "loudnorm=I=-16:TP=-1.5:LRA=11", "aresample=48000", "apad", `atrim=end=${TOTAL_SECONDS}`, `afade=t=out:st=${fade}:d=0.4`].join(",");
  ffmpeg(["-y", "-i", path, "-vn", "-af", chain, "-ac", "1", "-ar", "48000", "-c:a", "libmp3lame", "-b:a", "192k", out]);
  return out;
}

function render(): Promise<void> {
  return new Promise((done, fail) => {
    const args = ["exec", "tsx", "scripts/render.ts", "--copy-to", dir, ...(values.captions ? [] : ["--no-captions"])];
    const child = spawn("pnpm", args, { cwd: root, stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? done() : fail(new Error(`render exited ${code}`))));
  });
}

async function run(take: Take): Promise<void> {
  console.log(`voice-over ${take.path}`);
  const { alignment, range, length } = analyse(take.path);
  report(alignment, range, length);
  const vo = convert(take.path, alignment.offset);
  console.log(`wrote ${vo} (${duration(vo).toFixed(2)} s)`);
  await render();
  const cut = resolve(dir, output);
  const seconds = duration(cut);
  const audio = spawnSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_name", "-of", "csv=p=0", cut], { encoding: "utf8" }).stdout.trim();
  if (!(seconds > 0 && seconds <= 120) || !audio) throw new Error(`${cut}: ${seconds} s, audio "${audio}"`);
  console.log(`done ${cut}: ${seconds.toFixed(2)} s, audio ${audio}`);
  mkdirSync(resolve(root, "out"), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(take)}\n`);
}

if (!values.watch) {
  const take = findTake();
  if (!take) throw new Error(`no vo.* audio file in ${dir}`);
  await run(take);
} else {
  console.log(`watching ${dir} for vo.*`);
  let seen: Take | null = null;
  let failed: Take | null = null;
  for (;;) {
    const take = findTake();
    // Only once the file has stopped growing: a synced upload lands in pieces.
    if (take && sameTake(take, seen) && !sameTake(take, lastDone()) && !sameTake(take, failed)) {
      try {
        await run(take);
      } catch (error) {
        failed = take;
        console.error(error);
      }
    }
    seen = take;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
