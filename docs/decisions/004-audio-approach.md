# 4. Audio Approach: Remotion Audio vs FFmpeg Filter Graph

Date: 2026-10-05
Status: Accepted
Spike: 2c

## Context

SceneStitch must mix voiceover, SFX, and background music with automatic ducking (music volume reduced 4–7 dB under narration). Two approaches were evaluated:

- **(A) Remotion `<Audio>` with per-frame `volume` function**: audio mixed in the browser during render.
- **(B) Silent Remotion video + FFmpeg `amix` filter**: audio mixed as a post-processing step.

## Evidence

Spike: 5 seconds (150 frames) at 1080×1920 @ 30 fps, voiceover01.mp3 (2.5 s) + music01.mp3 (30 s) with ducking from 0.8 → 0.15 during VO playback.

### (A) Remotion `<Audio>` result

```
// volume function used:
volume={(frame) => calculateMusicVolume(frame)}

// where calculateMusicVolume does:
// - linear ramp from 0.8 → 0.15 over 5 frames at VO start
// - hold at 0.15 during VO (frames 0–75)
// - linear ramp from 0.15 → 0.8 over 10 frames at VO end
```

| Metric | Result | Pass? |
|---|---|---|
| Render succeeds | Yes | ✅ |
| Duration | 5.000 s | ✅ |
| Audio streams present | Yes | ✅ |
| Ducking envelope | Frame-accurate (per-frame volume fn) | ✅ |

### (B) FFmpeg `amix` result

```bash
ffmpeg -i silent.mp4 -i vo.mp3 -i music.mp3 \
  -filter_complex \
  "[2:a]volume=enable='between(t,0,2.5)':volume=0.15,...[music_ducked];
   [1:a][music_ducked]amix=inputs=2:duration=first[mixed]" \
  -map 0:v -map [mixed] -c:v copy -c:a aac out.mp4
```

| Metric | Result | Pass? |
|---|---|---|
| Render succeeds | Yes | ✅ |
| Ducking accuracy | Step-function (not frame-accurate) | ⚠️ |
| Implementation complexity | Higher (separate FFmpeg step) | ⚠️ |

## Decision

Use **approach (A): Remotion `<Audio>` with a per-frame `volume` function** as the primary audio pipeline for Phase 1 and 2.

The `volume` function receives the current frame number and returns a scalar 0.0–1.0. This gives sample-accurate control over ducking envelopes, fade-ins/outs, and SFX timing — impossible with the FFmpeg step-function `enable=` filter.

**Fallback (approach B)** is retained for:
- Very complex multi-track mixes (> 4 simultaneous audio streams) where browser audio mixing overhead becomes measurable.
- Post-production loudness normalization (`ffmpeg-normalize` / `loudnorm` filter), which always runs as a final FFmpeg pass on the exported MP4 anyway.

## Alternatives Considered

- **Web Audio API (OffscreenAudioContext)**: Not available in headless Chrome during Remotion render. Ruled out.
- **Pure FFmpeg filter graph**: Retained as fallback; documented above.

## Consequences

- Ducking envelopes are expressed as pure TypeScript functions: `(frame: number) => number`. These live in `packages/core` and are unit-testable.
- The render pipeline stays single-pass (no post-processing audio step for basic mixing).
- A final `ffmpeg -af loudnorm` pass is still required after Remotion export for LUFS normalization (FR-MUS-05). This is a fast single-pass operation and does not affect sync.
- The FFmpeg mux fallback is scripted and available in `spikes/render-spikes.ts` for reference.
