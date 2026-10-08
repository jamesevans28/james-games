# Backlog: inactive games and how to bring them back

These are set `status: "inactive"` in T5.1. Scores are kept. Each entry is the rework that would make it worth reactivating (T11.9).

## Car Crash

Problem: 3-lane grid stepping feels stiff; the "speed-up" never sped up the cars because positions were re-snapped every tick; difficulty wasn't reset on restart.
Rework: swipe-lane endless runner on continuous movement (no grid snap), 3 lanes → 4, near-miss bonus, kid-drawn vehicles from the art pipeline, coins to collect. Reuse the input kit `swipe()` and `holdZones()`.

## Block Breaker (was beta)

Problem: broken (static paddle body, unreachable game over, always-right deflection).
Rework: don't rebuild; add a "Bricks" mode to Paddle Pop (T5.8 stretch) that seeds a brick wall and scores per brick. Delete the folder once Paddle Pop has the mode.

## Ready Steady Shoot

Problem: only ~11% of the power bar mattered (speed clamped 1100–1500 from 0–3600), random side velocity made skill unreliable, debug bodies visible.
Rework: fold into Hoop City as a "Free throw" bonus round every 10 hoops (T5.6 stretch): one meter, linear power → arc mapping covering the full bar, no random spread, swish = +5.

## Fill the Cup

Problem: leaks (containers and mask graphics never destroyed), inconsistent spacing, shallow.
Rework: build one "conveyor timing" template (emitter over scrolling targets) with pure use-cases `targetWindow(speed, level)` and `judge(fillLevel, band)`; skins: cups (water), chimneys (presents), flowerpots (seeds), with AI-generated art. Fill the Cup becomes the default skin; difficulty from band width and conveyor speed.

## Ho Ho Home Delivery

Problem: overlap zone was the whole roof, spawn gaps compounded, no drop cooldown, seasonal.
Rework: the "chimneys" skin of the conveyor template above, enabled automatically in December (manifest `seasonal: { from: "12-01", to: "12-31" }` honoured by the registry).
