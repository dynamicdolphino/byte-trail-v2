# Byte Trail v2 (Comic Edition)

Mobile-first 2D comic-book runner. Steer Glitch, grow a tail of bytes through math gates, eat smaller bug-snakes, dodge scanner cones and break the FIREWALL at the end of each level.

Plain HTML, vanilla JS modules and one `<canvas>`. No build step for development, no dependencies, no network calls in the web build. All art and sound are generated in code.

## Run locally

ES modules need a static server (opening `index.html` from disk will not work):

```bash
python3 -m http.server 8123
```

Then open http://localhost:8123. On a phone in the same Wi-Fi, open `http://<your-computer-ip>:8123`.

## How to play

- Drag left or right anywhere (finger or mouse). The drag is relative, there is no joystick. Arrow keys or A/D also steer.
- Tap, Space or Enter starts, retries and continues.
- Gates change your tail: `+` and `×` help, `-` and `÷` hurt. You pass through the half you are on.
- Bug-snakes show their length. Green number: your tail is longer and you eat it (POW). Red number: touching it costs that many bytes.
- Scanner cones drain 1 byte every 0.2 s while you are inside.
- At the FIREWALL your bytes fight its HP one by one. Leftover bytes climb the ×1 to ×5 bonus steps; bytes × step = coins.
- Coins buy visor colors and trail styles in the shop (cosmetic only).

## Testing helpers

- `?level=N` starts at level N, for example http://localhost:8123/?level=12. The same N always builds the same level.
- `?platform=playables|poki|crazygames` picks a platform adapter. Without that platform's SDK on the page the game falls back to the web adapter.
- Clear progress: run `localStorage.removeItem('byte-trail-v2')` in the browser console.

## Platform layer

All platform calls go through [src/platform.js](src/platform.js):

| Mode | Save | Pause | Ads |
|---|---|---|---|
| `web` (default) | localStorage | Page Visibility | none, rewards are granted free |
| `playables` | `ytgame.game.loadData/saveData` | `ytgame.system.onPause/onResume` (never Page Visibility) | `ytgame.ads.requestRewardedAd`, `requestInterstitialAd` |
| `poki` | localStorage | Page Visibility | `PokiSDK.rewardedBreak`, `commercialBreak` |
| `crazygames` | localStorage | Page Visibility | `SDK.ad.requestAd('rewarded' / 'midgame')` |

Rewarded slots: OVERCLOCK (×3 coins on the clear screen) and REBOOT (+50% of the bytes you reached the firewall with, retry the boss once). Interstitials run at most every 3 levels, only between levels. Pause stops the loop, audio and input. The mute button sits in the HUD and on the title screen; the choice is saved.

Save data: level reached, best level, coins, owned and equipped cosmetics, mute. `sendScore` reports the best level.

## Build

```bash
python3 tools/zip.py
```

| Output | Use |
|---|---|
| `dist/web/` | Static site, no external requests |
| `dist/playables.zip` | YouTube Playables, adds the `ytgame` SDK script |
| `dist/poki.zip` | Poki, adds the Poki SDK v2 script |
| `dist/crazygames.zip` | CrazyGames, adds the CrazyGames SDK v3 script |

Each zip has `index.html` at its root and the script fails if a zip goes over 5 MB (they are about 22 KB). The platform builds load their SDK from the platform's own CDN, which those platforms require.

## Deploy

### GitHub Pages

1. Push this repo to GitHub.
2. Settings > Pages > Build and deployment > Source: Deploy from a branch. Pick `main` and `/ (root)`. `index.html` sits at the repo root, so the source folder works as is.
3. Open `https://<user>.github.io/<repo>/` after the first deploy finishes.

To publish only the built copy instead, push the contents of `dist/web/` to a `gh-pages` branch and pick that branch in step 2.

### YouTube Playables

1. Run `python3 tools/zip.py`.
2. Upload `dist/playables.zip` through the Playables submission flow you have access to. Playables runs through YouTube's partner program.
3. Test with the Playables test suite before submitting: pause/resume, audio toggle, save and load, rewarded and interstitial ads.

### Poki

1. Run `python3 tools/zip.py`.
2. In Poki for Developers, create the game and upload `dist/poki.zip`.
3. Check it in the Poki Inspector: loading finished, gameplay start/stop, commercial and rewarded breaks.

### CrazyGames

1. Run `python3 tools/zip.py`.
2. In the CrazyGames developer portal, submit a new HTML5 game and upload `dist/crazygames.zip`.
3. Use the portal's preview/QA tool to check loading events, gameplay start/stop and both ad types.

## Files

| File | Role |
|---|---|
| `index.html` | Page shell and canvas |
| `src/main.js` | Boot, DPR-aware canvas sizing, fixed-timestep loop, pause and audio wiring |
| `src/game.js` | State machine (title, shop, run, boss, bonus, clear, fail), rewards, save |
| `src/level.js` | Seeded level generator and difficulty ramp, track geometry |
| `src/entities.js` | Gate ops, bug-snake motion and hits, scanner cones |
| `src/trail.js` | Snake tail path buffer |
| `src/render.js` | World, effects, HUD and screens |
| `src/comic.js` | Palette, ink outlines, halftone, lettering, captions, bursts, buttons |
| `src/glitch.js` | Glitch the robot head and its expressions |
| `src/shop.js` | Cosmetics, trail styles, shop screen |
| `src/input.js` | Relative drag, keys, taps |
| `src/audio.js` | WebAudio blips |
| `src/platform.js` | Platform adapters |
| `tools/zip.py` | Build script |
