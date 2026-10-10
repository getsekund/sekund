# SEKUND pitch video

The 1:59.5 Colosseum pitch video as a [Remotion](https://www.remotion.dev) composition. It is drawn with the deck's own code (`deck/src`): the slides, the Bayer dither, the hero watch and the vector LCD, so the video and the deck cannot drift apart. The proof beat uses real captures of the watch simulator and the phone app (`public/captures/`).

```bash
pnpm dev:video            # Remotion Studio, http://localhost:4321
pnpm video:render         # out/sekund-pitch-2min-captions.mp4 and out/sekund-pitch-2min-poster.png
pnpm --filter @sekund/video render --no-captions
pnpm --filter @sekund/video render --stills 140,1000,3500   # review stills, out/frames/
pnpm --filter @sekund/video test    # timing, pace, captions, claims, team copy
```

The first render downloads Remotion's Chrome Headless Shell.

## Voice-over

`src/script.ts` is the script: eight beats, each line with the second it starts and the second it should end. Scenes, builds and captions all follow it. Goran's recording guide and the same lines with timecodes are in the Project store at `docs/submission/pitch-video-script.md`.

Goran records one take anywhere (phone or Mac), reading along with the captions cut, and drops it in a folder as `vo.<ext>`. Any format ffmpeg reads works: m4a, mp3, wav, aiff, caf, even a phone video. `pnpm video:vo` does the rest:

```bash
pnpm video:vo --dir <folder>            # <folder>/vo.* -> public/vo.mp3 -> <folder>/sekund-pitch-2min-vo.mp4
pnpm video:vo --dir <folder> --watch    # wait for vo.* to appear or change, then the same
pnpm video:vo --dir <folder> --captions # burn the captions in as well (-captions-vo.mp4)
pnpm video:vo --dir <folder> --offset 3.2   # skip the alignment: the video's 0:00 is 3.2 s into the take
```

- It finds the take's speech onsets and picks the offset that puts them on the cue starts (`scripts/vo-align.ts`), so the lead-in before Goran pressed play doesn't matter. It prints the offset and any line more than 0.35 s off its cue.
- Then it trims or pads the take to 0:00, normalises it to −16 LUFS, writes `public/vo.mp3` and renders. The cut is checked to be 2:00 or under with an audio track. `--watch` waits until the file has stopped growing, and skips a take it has already rendered.
- `public/vo.mp3` can also be put there by hand; the Studio plays it under the picture and `pnpm video:render` names the file `-vo`. Without it the cut is silent and the captions carry the script.
- Optional: `public/founder.mp4`, Goran on camera saying the team lines, up to 16 s. It plays in a frame on the team slide with its own sound, and the voice-over is muted for the team beat.
- If a line runs long, change its `at`/`end` in `src/script.ts`; `pnpm --filter @sekund/video test` checks that beats still meet and the pace stays readable.

## Team beat

The team beat is the deck's `team` slide. The scene reads the founders' names from it and raises each block when the voice-over says the name. If the slide's copy changes, `test/script.test.ts` fails until the team lines in `src/script.ts` say the same names, roles and companies.

## Captures

`public/captures/` comes from `scripts/capture.ts`. It drives the running apps (`pnpm dev`) through the approve flow on devnet in Playwright, with nothing mocked:

1. It unlocks the watch simulator and pays the simulator's address 0.02 SOL from the devnet funder (`companion/.devnet/funder.json`, or `SEKUND_FUNDER_KEYPAIR`).
2. It sends 0.01 SOL to the proof destination from the phone app, pages through the review on the watch and presses D.
3. It waits for the app's CONFIRMED card, reads the transaction back (the only signer is the simulator, 0.01 SOL to the destination) and captures that signature's Explorer summary.
4. The run is recorded in `captures.json` under `transaction`.

Explorer turns headless Chrome away, so the script needs a display. It stops before deleting anything if the funder has no SOL.

```bash
pnpm dev                  # leave running
pnpm video:capture        # needs DISPLAY and about 0.05 devnet SOL in the funder
pnpm --filter @sekund/video capture --explorer <signature>   # only the Explorer shot, again
```

The proof beat reads the run (`src/capture-run.ts`):

- **Confirmed run:** the phone app's card goes on to SIGNED and CONFIRMED, and the Explorer shot shows that same signature.
- **Run without a transaction:** the card is shown only while it waits for the watch and leaves as the watch signs, and the Explorer shot is the deck's 8 October transfer.

The committed captures are such a run. The faucet refused the capture machine, so nothing was broadcast. `test/captures.test.ts` fails if a SIGNED or CONFIRMED shot is present without a confirmed transaction.

`public/assets` and `public/fonts` are links to `deck/public/`.

## Licence

Remotion is used under its Free License, which covers individuals and companies of up to three people (`node_modules/remotion/LICENSE.md`). A larger company making the video needs a Remotion Company License.
