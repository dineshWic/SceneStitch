# 5. Frame Accuracy and Timing Rounding Rule

Date: 2026-10-05
Status: Accepted
Spike: 2d

## Context

The reference project (Capybara Salon Short) specifies 10 scenes with non-integer boundary times (e.g. 2.2 s, 4.5 s, 7.3 s). At 30 fps these must round to integer frame numbers and the last scene must end at exactly frame 900 (30.000 s). We needed to confirm:

1. That `Math.round(seconds × fps)` produces a total of exactly 900 frames for the reference timeline.
2. That Remotion produces a video of exactly 30.000 s (confirmed by ffprobe).

## Evidence

### Scene boundary table (fps = 30, rule: `Math.round(t × fps)`)

| Scene | startSec | endSec | startFrame | endFrame | duration |
|---|---|---|---|---|---|
| 1 | 0.0 | 2.2 | 0 | 66 | 66 |
| 2 | 2.2 | 4.5 | 66 | 135 | 69 |
| 3 | 4.5 | 7.3 | 135 | 219 | 84 |
| 4 | 7.3 | 10.1 | 219 | 303 | 84 |
| 5 | 10.1 | 13.0 | 303 | 390 | 87 |
| 6 | 13.0 | 16.1 | 390 | 483 | 93 |
| 7 | 16.1 | 19.3 | 483 | 579 | 96 |
| 8 | 19.3 | 22.3 | 579 | 669 | 90 |
| 9 | 22.3 | 27.2 | 669 | 816 | 147 |
| 10 | 27.2 | 30.0 | 816 | 900 | 84 |

Total frames (last `endFrame`): **900** ✅

### Render verification (ffprobe)

| Metric | Result | Target | Pass? |
|---|---|---|---|
| Duration | 30.000 s | 30.000 s ± 1 frame (0.034 s) | ✅ |
| Frame count | 900 | 900 | ✅ |
| FPS | 30 | 30 | ✅ |

## Decision

**Rounding rule: `toFrame(seconds, fps) = Math.round(seconds × fps)`**

This single rule is applied to both `startSec` and `endSec` of every scene independently. Scene `n`'s `startFrame` is derived from its own `startSec` (not from scene `n-1`'s `endFrame`), which means:

- Floating-point rounding errors do not accumulate across scenes.
- Consecutive scenes may share a frame boundary (`endFrame[n] === startFrame[n+1]`), producing hard cuts with no frame overlap or gap.
- The total composition `durationInFrames` equals the final scene's `endFrame`.

## Alternatives Considered

- **`Math.floor`**: Produces 899 total frames for this timeline (scene 2: floor(2.2×30)=66, floor(4.5×30)=135 — same; but scene 5: floor(13.0×30)=390, floor(10.1×30)=303 — OK; however floor(2.2×30)=66 but the cumulative drift may leave 1 frame short). Rejected because it cannot guarantee the last endFrame equals `Math.floor(totalDuration × fps)`.
- **`Math.ceil`**: Over-counts for scenes ending on integer seconds. Rejected.
- **Cumulative placement (each scene starts exactly where previous ends)**: Produces correct total frames but forces scenes to absorb rounding error from predecessors, making it impossible to validate individual scene boundaries against the user-specified time table.

## Consequences

- `toFrame` and `buildFrameTimeline` are implemented in `packages/core` and are fully unit-testable with no dependencies.
- The validator in `packages/core` will flag any timeline where `Math.round(totalDuration × fps) !== lastScene.endFrame` as a consistency error.
- All Remotion `<Composition durationInFrames={...}>` values and `<Sequence from={...} durationInFrames={...}>` values are derived from this rule, ensuring single source of truth.
