# Backlog: inactive games

These five games are set `status: "inactive"` (T5.1, 9 Oct 2026). Their code stays in `apps/player-web/src/games/<id>/` and still builds, but they are hidden from every list and the sitemap. A direct link shows a "taking a break" page. Bringing one back is T11.9: rework it on the Game SDK (follow the new-game checklist), ship as `beta`, then `active`.

Notes come from the October 2026 review.

## Car Crash (`car-crash`)

- **What it was:** a three-lane step dodger.
- **Why it's resting:**
  - Lane changes snap between grid steps, so it feels stiff.
  - The speed-up levels only speed up the lane stripes; the cars are re-snapped every tick.
  - Difficulty isn't reset on restart.
- **Rework idea:** a swipe-lane endless runner with the kids' car drawings, using `swipe()` from the input kit and smooth lane tweens. Speed should ramp on elapsed time.

## Block Breaker (`block-breaker`)

- **What it was:** Breakout.
- **Why it's resting:** it is broken.
  - The paddle body is static, so the ball bounces off an invisible centre paddle.
  - The ball can't leave the world bounds, so game over is unreachable.
  - Deflection always goes right.
- **Rework idea:** don't revive it as its own game. Fold bricks into Paddle Pop as a "Bricks" mode (stretch goal in T5.8), then delete this folder.

## Ready Steady Shoot (`ready-steady-shoot`)

- **What it was:** two-step basketball (aim, then power).
- **Why it's resting:** it's frustrating as tuned.
  - Only about 11% of the power bar changes the shot (speed is clamped to 1100–1500 out of a 0–3600 range).
  - A random sideways velocity of ±50–150 makes skill unreliable.
  - Debug physics bodies are visible.
- **Rework idea:** a "Free throw" bonus round inside Hoop City every 10 hoops (stretch goal in T5.6), with a fixed, readable power curve and no random drift. Then delete this folder.

## Fill the Cup (`fill-the-cup`) and Ho Ho Home Delivery (`ho-ho-home-delivery`)

- **What they were:** both are "fixed emitter over scrolling targets": hold to pour into passing cups, or drop presents into passing chimneys.
- **Why they're resting:**
  - Fill the Cup leaks a container and a mask graphic per cup.
  - Ho Ho's hit zone is the whole roof rather than the chimney, and its first spawns compound the gap (320, 640, 960).
- **Rework idea:** one "conveyor timing" template game with skins: cups, chimneys, or whatever the kids draw. Seasonal swaps (Christmas chimneys in December) come from the manifest. Build it as a new SDK game, then delete both folders.
