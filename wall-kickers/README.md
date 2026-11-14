# Wall Kickers — White-Black Sakura

Standalone mobile web rebuild in this folder; QQCross main game files are untouched.

## Sources used
- User-supplied `index(2).html`: 30×45 player, gravity 0.6, horizontal jump impulse 7, vertical impulse -11, wall contact and camera logic.
- User-supplied `wall_kickers.html` and `wall_kickers_cave_run.html`: touch flow, pause/retry, obstacle and score patterns.
- User-supplied Wall Kickers APK audit: KumoGame inventory and scenario families from `WJScenarios.dat`.
- White-Black Sakura sprite atlas and manifest from the user's project materials.

## Included
- Wall-to-wall climbing with touch/hold, second-tap recovery, camera, score, best score, pause, retry and game over.
- Procedural segments: stairs/path, bouncy and crumbling platforms, conveyors, flipping platforms, electric bars, spike balls and spikes.
- White-Black Sakura environment, drifting petals and platform sprites. Platform collision uses only the top 4 px.
- Shared character/map selection screen. Two samurai unlocks cost 500 coins each; coins are earned in runs only. No ads, donations, gifts, boosts, legacy shop or real-money purchases.
- Pink Sakura appears only as a separate untouched map entry.

## Validation
`node --check` passed. Headless Chromium smoke tests passed at 393×852, 360×800, 320×568 and 432×768, including atlas loading, five consecutive wall jumps, score progression, pause/resume, collection tabs and the 500-coin unlock flow.

The Android APK uses a native KumoGame runtime and packed level/animation/texture formats. This folder reconstructs the playable mechanics from the supplied prototype and APK audit; it does not run the original native engine.