# Product renders (slide 7, "Target design, render.")

Generated 10 Oct 2026 from Goran's reference (`../slide9-reference-watch.png`): matte black resin digital watch, slight three-quarter view, studio lighting, steel pushers, pure black ground, SEKUND the only word. None of these is a photo of hardware; the deck labels the one in use as a render.

- `sekund-target-render.png`: the one on slide 7, as it appears there, cropped from a 2× export (1600 × 1300). Candidate A with the simulator's APPROVE? page on the LCD. The page is not a raster paste any more: the deck draws it as vector (`deck/src/ui/LcdApprove.tsx`, the simulator's own LCD geometry, DSEG and 5×7 dot type) and lays it over the panel with an affine fit to the window's corners, so it is crisp at 1× and 2× (a warped raster read "APPPOVE?" at slide size). The panel underneath is blanked but keeps its own shading, so the display still reads as lit glass.
- `sekund-target-render-blank-lcd.png`: the 1024 px picture the deck actually loads (`deck/public/assets/watch-target-render.png`): candidate A with the LCD window blanked to the simulator's panel tint under the render's shading. The page is drawn over it live.
- `candidate-a-square-bezel.jpg`: chosen base. Rounded-square case, four pushers, near-square LCD, matches the hero illustration and the 3D simulator's proportions.
- `candidate-b-octagon-bezel.jpg`: rejected, octagonal bezel reads as a G-Shock silhouette.
- `candidate-c-soft-case.jpg`, `candidate-d-soft-case-squarer-lcd.jpg`: rejected for this deck. The most original silhouette of the set, but a landscape LCD (the simulator's is near-square, so the APPROVE? page would not fit without letterboxing) and only three pushers on one side. Worth keeping as a design direction.
