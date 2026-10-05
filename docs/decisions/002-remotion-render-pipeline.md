# 2. Remotion Render Pipeline

Date: 2026-10-05
Status: Accepted
Spike: 2a

## Context

The core rendering engine must produce 1080×1920 @ 30 fps MP4 output from a mix of video clips and still images (with Ken Burns zoom). Before committing to Remotion as the visual pipeline we needed to prove it can render such a composition on this machine within a reasonable time budget (< 3 minutes for a 15-second clip at concurrency 2).

## Evidence

Spike composition: 3 × video clips (`OffthreadVideo`) + 1 × Ken Burns still image (`Img` + CSS `scale` interpolation), total 450 frames (15.0 s) at 1080×1920 @ 30 fps.

| Metric | Result | Target | Pass? |
|---|---|---|---|
| Duration | 15.000 s | 15.000 s | ✅ |
| Resolution | 1080 × 1920 | 1080 × 1920 | ✅ |
| FPS | 30 | 30 | ✅ |
| Codec | h264 | h264 | ✅ |
| Render time | 1 m 26 s | < 3 min | ✅ |

Headless Chrome Shell (Remotion renderer) was auto-downloaded on first run and cached at `~/.cache/puppeteer`. Subsequent runs do not re-download.

## Decision

Use **Remotion (`@remotion/bundler` + `@remotion/renderer`)** as the primary visual rendering pipeline. `OffthreadVideo` is used for video clips (renders each frame off the main thread via FFmpeg) and `Img` + CSS `transform: scale()` is used for Ken Burns still images.

## Alternatives Considered

- **FFmpeg-only pipeline**: Rejected as primary path. FFmpeg's `zoompan` filter is harder to express declaratively per-scene, does not integrate with a React component tree, and would require a separate preview path for the web UI.
- **FFmpeg as fallback**: Retained as documented fallback if Remotion render times exceed acceptable limits at higher concurrency settings on lower-spec hardware.

## Consequences

- `packages/composition` depends on `remotion`, `react`, and `react-dom`.
- The server will use `@remotion/bundler` and `@remotion/renderer` for headless export.
- Ken Burns effect is implemented via `interpolate(frame, [0, duration], [zoomFrom, zoomTo])` on a CSS `transform: scale()`. This approach is frame-accurate and easing-configurable.
- Chrome Headless Shell (~92 MB) is required at render time; it is cached after first download.
