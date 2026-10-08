# PULP — Fruit Ninja with your hands (or your eyes)

A browser game: your webcam tracks your index fingertips (MediaPipe hand landmarker) and they
become blades. Swipe fast through fruit to slice it; slow movement doesn't cut. Don't hit bombs.
There is also an experimental **eyes** mode: webcam gaze tracking (MediaPipe face mesh + irises,
calibrated per session).

```sh
./pulp-run          # serves on http://localhost:8090 and opens Chrome
./pulp-run 9000     # another port
npm test            # game logic, input and gaze-fit tests (Node 18+)
```
Everything is local (MediaPipe JS + wasm in `vendor/`, models in `models/`), so it works offline.
Only the title font comes from Google Fonts, with a system fallback.

## Playing
* **Classic** — 3 dropped fruit or one bomb ends it. Combos: 3+ fruit in one swipe = bonus.
* **Zen** — 90 seconds, no bombs.
* Menus are fruit too: slice one to pick it.
* Hands: stand/sit so your hand is visible; only the middle of the camera picture maps to the
  whole screen (`zone` in `src/hands.js`), so you don't have to reach to the edges. Both hands work.
* The game pauses itself if your hand leaves the picture for 2.5 s.

## Eyes (beta)
1. Choose **EYES** on the menu (or press `E`). Follow the dot with your eyes, head still (13 dots).
2. 7 more dots measure accuracy; the result screen shows where it thought you looked.
3. In the game, fruit is cut by **flicking** your eyes across it (a saccade is a fast jump, which
   is a blade stroke) or by **dwelling** on it ~0.4 s (a ring fills). `X` switches flick / dwell / both.
   Eye mode has bigger, slower fruit, and a bomb costs a life instead of the game.
* `D` re-centres drift (look at the dot). `K` recalibrates. Close your eyes ~1 s to pause.
* Blinks are filtered out (the iris landmarks jump while the lids close).
* How gaze is estimated: `src/gaze.js` — iris position within each eye, eyelid opening,
  MediaPipe's eye-look blendshapes, and head pose/position → ridge regression to screen pixels.
  The feature set (linear or quadratic) and regularisation are chosen by leave-one-dot-out
  cross-validation.

## Keys
`SPACE` pause · `ESC` menu · `F` fullscreen · `V` camera thumbnail · `G` camera as background ·
`C` next camera · `H`/`E`/`M` hands / eyes / mouse · `1`/`2` classic / zen · `?` help

## Notes
* Camera: picks the remembered camera, else the first one that delivers non-black frames
  (the FaceTime camera and an iPhone via Continuity Camera can both show up). `C` cycles.
* URL flags for testing: `?input=mouse` (no camera), `?autostart=classic|zen|1`, `?demo=1`
  (a bot slices fruit), `?seed=N`. `window.pulp` exposes the app state in the console.
* Script errors are shown in the bottom-left corner of the page.

## Layout
`src/game.js` world + physics (pure) · `src/blade.js` swipe → cut segments · `src/hands.js`,
`src/eyes.js` inputs · `src/gaze.js`, `src/calibration.js` gaze model · `src/render.js`,
`src/sprites.js` drawing · `src/audio.js` synthesised sounds · `src/main.js` screens and loop.
