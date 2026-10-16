# Byte Trail v2 (Comic Edition): project rules
## Mechanics (identical to v1, do not change)
- Top-down vertical auto-runner, portrait. Glitch (robot head with ">_" visor) moves up automatically; the player drags left/right to steer freely across a 5-lane-wide track.
- A trail of "bytes" follows Glitch like a snake tail; tail length = power.
- Gates: pairs like +5, x2, -3, /2. Passing one changes the tail length instantly.
- Rival bug-snakes: touch one; if your tail is longer you eat it (+its length), if shorter you lose bytes equal to its length.
- Firewall scanners sweep a vision cone; inside the cone you lose 1 byte per 0.2 s.
- Level end: FIREWALL boss with an HP number, fought byte by byte; enough bytes = clear, otherwise fail. Then a bonus row of multiplier steps x1..x5 from leftover bytes = coins.
- Levels 30-45 s, generated from a seed per level number (deterministic), difficulty ramps. Instant restart.
- Coins buy visor colors and trail styles (cosmetic only).
## Visual direction: bright comic book
- Palette: paper white #FFF8E7 background, ink black #111111 outlines, saturated primaries: red #FF3B30, yellow #FFD60A, blue #1E6BFF, plus accent green #34C759 and magenta #FF2D95. No dark backgrounds.
- Every object has a bold black ink outline (3-4 px at 1x), flat fills plus one hard-edged shadow tone.
- Halftone dot shading (drawn in code) on shadows, track edges and backgrounds; Ben-Day dot patterns on gates.
- Glitch: chunky comic robot head, thick outline, expressive visor eyes (happy, worried, shocked).
- Onomatopoeia bursts drawn in code with jagged speech-burst shapes and slanted bold lettering: POW on eating a bug-snake, ZAP in scanner cones, BOOM on boss hits, KA-CHING on coins, +5/x2 popping as comic captions.
- Action lines/speed lines while running; panel-border frame around the HUD; light screen shake on impacts.
- Text: chunky bold lettering drawn in code or a system sans-serif fallback (no external fonts).
## Tech
- Plain HTML + vanilla JS (ES modules) + one <canvas>. No frameworks, no build step, no CDN, no external fonts, no network calls. All art drawn in code. Total zip < 5 MB.
- Mobile first: portrait, one-finger relative drag steering (no joystick), mouse works too. DPR-aware canvas, scales to any screen. Fixed timestep update.
- Platform layer: all platform calls go through src/platform.js with "web" (localStorage), "playables" (ytgame SDK), "poki", "crazygames" stubs. Hooks: init(), firstFrameReady(), gameReady(), onPause(cb), onResume(cb), isAudioEnabled(), onAudioChange(cb), load(), save(str), sendScore(n), showRewarded() -> Promise<boolean>, showInterstitial(), gameplayStart(), gameplayStop().
- Pause = stop loop, audio, input. Never use the Page Visibility API in playables mode.
- Rewarded slots: "Overclock" (x3 coins at level end) and "Reboot" (+50% bytes, retry the boss once). Interstitial at most every 3 levels, never mid-level.
- Save: level reached, coins, unlocked cosmetics, best level. sendScore = best level.
- Sound: tiny WebAudio blips generated in code; respect mute.
- Small files, no dead code, README.md kept updated. No analytics, trackers or external requests.
