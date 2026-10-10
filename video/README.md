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

- Put the recording at `public/vo.mp3`, one file from 0:00, and render again. The audio is laid from frame 0 and the render's file name gains `-vo`.
- Without `vo.mp3` the cut is silent and the captions carry the script.
- Optional: `public/founder.mp4`, Goran on camera saying the team lines, up to 16 s. It plays in a frame on the team slide with its own sound, and the voice-over is muted for the team beat.
- If a line runs long, change its `at`/`end` in `src/script.ts`; `pnpm --filter @sekund/video test` checks that beats still meet and the pace stays readable.

## Team beat

The team beat is the deck's `team` slide. The scene reads the founders' names from it and raises each block when the voice-over says the name. If the slide's copy changes, `test/script.test.ts` fails until the team lines in `src/script.ts` say the same names, roles and companies.

## Captures

`public/captures/` comes from `scripts/capture.ts`, which drives the running apps (`pnpm dev`) through the approve flow in Playwright: it unlocks the watch simulator, sends 0.01 SOL to the proof destination from the phone app, pages through the review on the watch, presses D and waits for SIGNED. Two devnet calls are held back: the balance read (the simulator address is unfunded and the faucet is rate-limited) and the broadcast, so the capture run is never sent. The on-chain proof in the video is the confirmed transfer on the deck's proof slide.

```bash
pnpm dev                  # leave running
pnpm video:capture
```

`public/assets` and `public/fonts` are links to `deck/public/`.

## Licence

Remotion is used under its Free License, which covers individuals and companies of up to three people (`node_modules/remotion/LICENSE.md`). A larger company making the video needs a Remotion Company License.
