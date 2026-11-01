# Implementation and acceptance status

The original plan is a target specification, not evidence of completed acceptance gates. This file records implementation status separately; do not infer performance or output parity from the existence of code.

## Implemented

- Project CRUD, duplication, templates, atomic writes, autosave, rolling snapshots, recovery and session undo/redo.
- Asset upload, probing, constant-fps video normalization, thumbnails, audio peaks, license fields and filename assignment.
- Scene table, paste/import review, frame rounding, reorder/delete/ripple, fit/crop/motion controls, shared Remotion preview.
- VO and SFX timing, negative-offset source trimming, fades, music ducking/overrides, captions and safe-zone overlay.
- Incoming transitions and split-screen scene references with missing/cycle diagnostics.
- Sequential render jobs, progress polling, cancellation, temporary output cleanup, draft/final rendering, two-pass loudness processing and ffprobe verification.
- CLI export, SRT, credits, WAV mix, offline plan extraction and optional cloud extraction with schema validation/fallback.

## Acceptance work

Actual build, test and render results are recorded below once checks run. Performance gates require representative hardware and the full reference project's real media. Emoji appearance depends on installed fonts; cross-platform font parity still requires visual verification. Cloud extraction requires a user-configured API key and has not been tested against a paid provider here.

## Verification performed

- All five packages build; all package TypeScript checks pass.
- Core: 36 tests; composition: 3; server: 29; CLI: 1; web: 1. These include real ffprobe and video normalization, audio envelopes, negative-offset source trimming, storage snapshots and render-media HTTP ranges.
- Headless Chromium UI smoke test: created a project, added a scene, extracted/reviewed/applied a two-scene production plan and confirmed autosave, without an application error.
- Real synthetic eight-second render: 240 frames, 360 × 640, 30 fps, H.264 with audio, -14.41 LUFS, no project warnings. SRT, credits and WAV were produced. Frames from image, video and split-screen scenes were visually inspected; the caption emoji rendered correctly on this Windows machine.
- Follow-up one-second export tested the restricted media server and overlapping music repeats: 30 frames, H.264/AAC, -14.03 LUFS and -12.37 dBTP true peak. The deliberately short scene correctly produced a narration-overrun warning.
- This export took about 193 seconds including bundling. **The performance gates are not met by this measurement.** This is not a 1080p reference-project benchmark. Further profiling and full-reference validation are required before claiming G2/G3 or a production v1.0 release.
- Chromium, Node and FFmpeg used for verification were installed as portable tools in the workspace. `Start-SceneStitch.ps1` can use those tools on this Windows workspace, or fall back to tools on PATH.

Further acceptance work: original production-media reference validation and sub-frame audio-sync measurements, preview/export frame comparison across platforms, novice workflow timing, cloud-provider extraction tests, and production packaging checks. Core coverage and real active-render cancellation have now been verified below. The optional Dockerfile has not been built here.

Phase 4 optional Whisper/TTS, word-level captions, tagged SFX library, GPU encoding, CTA end cards and hosted deployment remain backlog items, as specified in the plan.

Progress delivery uses HTTP polling rather than WebSocket. Export records persist atomically in `.jobs/` and reload on startup. Interrupted jobs are marked failed with a retry message; incomplete video/sidecars are cleaned. Cancellation and failures are isolated so later queued exports continue. Interrupted jobs are not silently rerendered. The UI supports scene references for split-screen sources; direct asset sources are also accepted by the schema.

## Continued development commits

- `d03c360`: checkpoint of the local editor and export implementation verified above.
- Export reliability step: durable queued/running/terminal job records, restart recovery, cancellation cleanup and tests for queue ordering and failure isolation.
- `b960fa0`: committed export reliability. Queue/API tests: 11 passed, including active cancellation, skipped waiting jobs, continued processing after failure, and restart cleanup.
- Render performance step: compiled ducking envelopes, one Chromium instance per export, configurable worker count, explicit draft/final encoder presets, safe odd-dimension handling, cancellable bundle waiting, and per-phase timing reports. Core tests: 37 passed; render configuration/queue tests: 5 passed. Build, type checks, lint and formatting pass. A repeatable 30-second synthetic benchmark is provided; measured results follow separately.
- `abfdcea`: committed render performance tooling and optimizations.
- Core coverage step: 45 tests pass, measured 99.14% lines/statements, 95.65% functions and 92.2% branches. CI now enforces an 80% minimum on all four metrics. Additional cases cover malformed times, quoted CSV, exhausted in-points, missing/circular references, invalid audio assignments, template settings, credits and assignment idempotence.
- `f8a922c`: committed coverage gates and edge-case tests.
- Thirty-second synthetic draft baseline: 900 frames at 540 × 960, H.264/AAC, -14.05 LUFS, -9.44 dBTP and no project warnings. Cold run 234.4 s (40.6 s bundle, 182.8 s frames); warm run 184.6 s (174.4 s frames). Both remain above the 45 s draft target. The eight-core Windows verification machine reports approximately 20 GB RAM.
- Draft proxy step: referenced visuals are resized into a source-keyed cache; timing/composition and originals stay unchanged. A real FFmpeg test verifies smaller dimensions, exact duration/fps, original preservation, cache reuse, unused-media skipping and cancellation. Follow-up performance measurements are separate from this correctness test.
- `a8fb9ce`: committed draft proxy caching.
- Export-history UI step: saved jobs can be selected in the editor after reload. The Chromium smoke test creates a deliberately invalid export, reloads the page, reopens the project and confirms that its persisted failure diagnostic is visible. Full regression: 85 tests passed (45 core, 35 server, 3 composition, 1 CLI, 1 web).
- `3445d76`: committed recovered export history in the editor.
- Draft proxy benchmark: cold 159.9 s and warm 113.4 s (105.1 s frame rendering). Compared with the 184.6 s warm baseline, the warm export is about 39% faster. The 45 s draft gate still fails.
- Actual Chromium cancellation smoke test passed after frame rendering started; no final MP4, partial MP4, normalized MP4, SRT, credits or WAV remained. Restarting the test API process also reloaded the failed-job log correctly.
- Full-resolution synthetic export with four workers: 1080 × 1920, H.264/AAC, 900 decoded frames, 30.016 s container duration (video 30.000 s), -14.05 LUFS, -9.44 dBTP, no project warnings. Total 182.6 s, slightly above the 180 s target. Pixel checks confirmed the first cut at frame 66 and a fully white flash at frame 669. Narration and negative-offset SFX were detected in their planned audio windows. Nine boundary frames were visually inspected, including captions/emoji and the before/after split. These checks do not establish sub-frame sync or cross-platform parity.
- The same final fixture with `SCENESTITCH_RENDER_CONCURRENCY=6` completed in 175.7 s (167.0 s frame rendering), with matching codec, dimensions, 900 frames, loudness and true peak. This single run meets the 180 s final-render target on this eight-core machine. It does not establish the performance gate across other hardware; the default remains at most four workers, and the draft target remains open.

Machine-readable measurements are recorded in [verification/2026-11-01.json](verification/2026-11-01.json). The acceptance checks and benchmark use synthetic media and are not grounds to claim complete G3/v1.0 acceptance.

Music repeats use short overlapping fades at the seam. Caption styling is exposed through built-in presets rather than a full custom typography panel. Templates retain audio timing/mix settings with cleared media references. Undo uses bounded immutable project snapshots rather than Immer patches; it covers the editor's scene, asset metadata and audio edits.
