# Step-by-Step Development Plan
## Video Sequence Assembler (SceneStitch)

| | |
|---|---|
| **Based on** | SRS v0.1 (`SRS_Video_Sequence_Assembler.md`) |
| **Date** | 2026-10-05 |
| **Total effort** | about 56 working days to v1.0 (full-time, one developer) |
| **How to use** | Work the steps in order. Each step has tasks, a deliverable, a "done when" check and the SRS IDs it covers. Do not start a step until the previous gate is passed. |

---

## 0. Working Method (applies to every step)

1. **One branch per step** (`step-07-render-service`), merged to `main` only when "Done when" is met.
2. **Test first for core logic.** Anything in `packages/core` gets unit tests before UI work depends on it.
3. **Use the reference project** (capybara Short) as the test fixture from Step 3 onward. Every step ends with a demo run on it.
4. **Commit message format:** `feat(core): frame conversion [FR-TL-04]`, so SRS IDs stay traceable.
5. **Keep a `docs/decisions/` folder** with one short ADR per significant choice.
6. **Timebox spikes.** If a spike overruns by 50 %, stop and use the documented fallback.

### SRS updates adopted into this plan
Based on the copyright discussion, two requirements are raised or added:
- **FR-AST-06** (license note per audio asset): raised from *Could* to **Must**, Phase 2.
- **FR-AST-07 (new):** warn when an audio asset has no license info or is marked non-commercial; **Must**, Phase 2.
- **FR-EXP-06 (new):** export a **credits/attribution text file** per project; **Should**, Phase 3.

---

## Phase 0: Foundation & Spikes (≈ 5 days)

### Step 1: Environment and repository (Day 1)
**Goal:** a working monorepo and CI.

**Tasks**
1. Install Node.js 20+ LTS, pnpm, FFmpeg 6+ (verify with `node -v`, `pnpm -v`, `ffmpeg -version`, `ffprobe -version`).
2. Create the repo and workspace:
   ```
   scenestitch/
     package.json            # private, workspaces via pnpm-workspace.yaml
     pnpm-workspace.yaml     # packages/*
     tsconfig.base.json
     packages/core  composition  server  web  cli
   ```
3. Configure TypeScript (strict), ESLint, Prettier, Vitest.
4. Add a CI workflow (lint, type-check, test) that runs on every push.
5. Add `samples/` with 3 short test clips, 2 images, 1 VO file, 1 music file (royalty-free, license recorded).

**Deliverable:** empty packages that build; green CI.
**Done when:** `pnpm -r build && pnpm -r test` passes locally and in CI.

### Step 2: Risk spikes (Days 2–5)
**Goal:** resolve the four biggest technical unknowns before building on them.

| Spike | What to prove | Fallback if it fails |
|---|---|---|
| **2a. Remotion render** | 3 clips + 1 image with Ken Burns render at 1080×1920 @ 30 fps in under ~3 min | Evaluate FFmpeg-only pipeline for visuals |
| **2b. Emoji captions** | Emoji and large styled text render identically in `<Player>` and in a rendered MP4 | Bundle an emoji font or render emoji as images |
| **2c. Audio approach** | Compare (A) Remotion `<Audio>` with per-frame `volume` function vs (B) FFmpeg filter graph for mixing + ducking. Pick the one with correct sync and simpler code | Use (B) for the audio and mux onto Remotion's silent video |
| **2d. Frame accuracy** | 10 scenes with boundaries 2.2, 4.5, 7.3 … render to exactly 900 frames at 30 fps; ffprobe confirms duration 30.000 s | Adjust rounding rule; document it |

**Deliverable:** a short ADR for each spike (decision, evidence, fallback).
**Gate G0:** all four spikes resolved. If not, stop and re-plan before Step 3.

---

## Phase 1: Visual Assembler MVP (≈ 15 days)

### Step 3: Core package, schema, timing, parser (Days 6–8)
**Goal:** all timeline logic in pure TypeScript with tests.

**Tasks**
1. **Zod schema** for Project, Asset, Scene (Appendix A of the SRS); export TypeScript types from the schema.
2. **Timing utilities:**
   - `toFrame(seconds, fps) = Math.round(seconds * fps)`
   - `buildFrameTimeline(scenes, fps)` so each scene's start frame equals the previous end frame; total frames = last end frame.
3. **Table parser** accepting Markdown tables, CSV and tab-separated text. Handle time formats like `0.0–2.2s`, `0.0-2.2`, `00:02.2`. Normalize en-dashes, strip units.
4. **Validator:** gaps, overlaps, non-increasing times, zero-length scenes; return a list of `{sceneId, code, message}`.
5. **Fit calculator** (`trim`, `speed`, `loop`, `freeze-last`) returning `{inPoint, playbackRate, loops, freezeFrames, warnings[]}`.

**Deliverable:** `packages/core` v0.1 with ≥ 80 % coverage.
**Done when:** the capybara timeline pasted as text yields 10 scenes, 900 frames total, zero validation errors; a deliberately broken table yields correct error messages.
**SRS:** FR-TL-01…05, FR-VIS-03/04/06, FR-PRJ-04, NFR-03, NFR-07.

### Step 4: Composition package, visuals (Days 9–10)
**Goal:** a Remotion composition that renders a project plan visually.

**Tasks**
1. Root composition that takes a **computed plan** (from core) as input props; use `calculateMetadata` so duration comes from the plan.
2. `SceneVisual` component: image via `<Img>`, video via `<OffthreadVideo>`, wrapped in `<Sequence>` per scene.
3. Ken Burns (zoom from/to, easing) for images and optional for video.
4. Crop modes: `cover` and `contain` (with blurred background fill).
5. Apply playback rate, in-point, loop and freeze behavior from the fit calculation.

**Deliverable:** `packages/composition` renders a silent version of the reference project.
**Done when:** a stills check at each scene boundary frame shows the correct scene; no black frames at cuts.
**SRS:** FR-VIS-01/02/05, FR-TRN-01, C-4.

### Step 5: Server, projects and assets (Days 11–13)
**Goal:** persistent projects and media import.

**Tasks**
1. Fastify server bound to `127.0.0.1`; CORS only for the dev UI.
2. **Project storage:** folder per project: `project.json`, `media/original/`, `media/work/`, `thumbs/`, `exports/`. CRUD endpoints. Write atomically (temp file, then rename).
3. **Asset upload** endpoint with filename sanitizing.
4. **ffprobe service:** duration, width/height, fps, rotation, audio presence; store in asset metadata.
5. **Normalization** to a working copy, never touching the original. Typical command for video:
   ```
   ffmpeg -i in.mov -vf "fps=30" -c:v libx264 -crf 16 -preset fast \
          -pix_fmt yuv420p -c:a aac out.mp4
   ```
   (FFmpeg applies rotation metadata automatically.)
6. Thumbnail generation (first frame / midpoint).
7. Endpoint to parse a pasted timeline using the core parser.

**Deliverable:** API that creates a project, imports assets and returns probe data.
**Done when:** a rotated, variable-frame-rate phone clip imports and its working copy plays at a constant 30 fps.
**SRS:** FR-PRJ-01/02, FR-AST-01/02/04, FR-TL-03, NFR-09.

### Step 6: Web UI v1 (Days 14–16)
**Goal:** edit scenes visually and see them play.

**Tasks**
1. Vite + React + Tailwind; Zustand store holding the project; Immer patches for future undo.
2. **Layout:** asset library (left), 9:16 `<Player>` (centre), properties panel (right), scene table (bottom).
3. **Scene table:** editable start/end/label; paste-table dialog; inline validation highlights.
4. **Asset assignment:** drag an asset onto a scene row, or pick from a dropdown.
5. **Properties panel:** fit mode, in-point, crop mode, zoom from/to.
6. **Player:** connected to the same composition as the renderer.
7. Debounced save to the server.

**Deliverable:** usable editor for silent videos.
**Done when:** you can build the reference project from scratch in the UI in under 10 minutes and play it.
**SRS:** FR-TL-01/02/05, FR-VIS, FR-PRV-01…03.

### Step 7: Render service and CLI (Days 17–19)
**Goal:** export a real MP4 with progress and verification.

**Tasks**
1. Render service using `@remotion/bundler`, `selectComposition`, `renderMedia`; set concurrency from CPU count (configurable).
2. Job model: `queued → running → done | failed | cancelled`; keep logs per job.
3. WebSocket progress events to the UI; cancel support that cleans up partial files.
4. Output to a temp name, then rename on success (no corrupt outputs).
5. **Verification step** with ffprobe: duration (±1 frame), resolution, fps, codec.
6. CLI: `scenestitch render <project-dir> --draft|--final`.
7. UI export dialog with progress bar and result link.

**Deliverable:** end-to-end export.
**Gate G1 / Milestone M1:** the reference project exports a **silent 30.000 s 1080×1920 MP4**; cuts land exactly on the table's frames (checked by extracting frames at each boundary).
**SRS:** FR-EXP-01/02, FR-PRV-03, NFR-01/05.

---

## Phase 2: Audio & Captions (≈ 20 days)

### Step 8: Audio core logic (Days 20–23)
**Goal:** all audio timing in tested pure functions.

**Tasks**
1. **Absolute timing:** convert scene-relative offsets to project time for VO, SFX (including negative offsets, clamped at 0).
2. **VO overrun detection:** compare VO duration + offset against scene end; return warnings and suggested fixes (≤ 1.1× speed-up, tail-silence trim, manual).
3. **Ducking envelope** (pure function, returns gain in dB per time):
   1. Collect VO intervals in project time.
   2. Merge intervals separated by less than 0.25 s.
   3. Pad each interval: `attack` 0.15 s before, `release` 0.35 s after.
   4. Gain = `baseDb` outside, `baseDb + duckDb` inside, ramped linearly in dB over attack/release.
   5. Add manual override ranges on top.
4. Unit tests with the reference VO timings: assert gain values at sample times and absence of discontinuities.

**Deliverable:** `core/audio` module.
**Done when:** tests prove ducking depth, ramp timing, merging and override behavior.
**SRS:** FR-VO-01/03/04, FR-SFX-02, FR-MUS-02/03.

### Step 9: Captions (Days 24–27)
**Goal:** large, styled, emoji-safe captions.

**Tasks**
1. `Caption` component with style presets (font, size, stroke, shadow, background box, position, alignment).
2. Entrance animations: none, pop, fade.
3. Frame window = scene start + offset to scene end (configurable).
4. **Auto-fit:** shrink font so text stays within the safe width.
5. **Safe-zone overlay** in the preview only (never rendered): bottom ~20 % and right-side strip.
6. UI: caption text field and offset per scene; preset picker.
7. Use the Step 2b result for emoji handling.

**Deliverable:** captions in preview and export.
**Done when:** all 10 reference captions (including emoji) appear at the planned offsets and match between preview and export frames.
**SRS:** FR-CAP-01…05.

### Step 10: Audio import, waveforms, auto-assignment (Days 28–30)
**Tasks**
1. Audio asset import with probe; waveform data generation (peaks file) for display.
2. **VO from one long file + timestamps:** cut with FFmpeg into per-scene clips.
3. **Filename auto-assignment:** `scene_01.*` to scene 1 visual, `vo_01.*` to scene 1 voiceover, `sfx_01_*.*` to scene 1 SFX.
4. **License metadata per audio asset** (source, license type, URL, date, commercial-use yes/no); **warning** when missing or non-commercial.
5. UI: waveform thumbnails; license form on the audio asset.

**Deliverable:** drop a folder of named files, and the project fills itself.
**Done when:** the reference sample folder maps correctly with no manual dragging.
**SRS:** FR-AST-03/05/06/07, FR-VO-02.

### Step 11: SFX with J-cuts (Days 31–32)
**Tasks**
1. SFX list per scene: asset, offset (may be negative), gain, fade in/out.
2. Mixer support for clips that start before the scene boundary.
3. UI: SFX rows in the properties panel.
4. Test: Scene 3 water SFX starting 0.2 s before the Scene 3 cut.

**Done when:** an audio render shows the SFX onset at exactly `sceneStart − 0.2 s`.
**SRS:** FR-SFX-01…03.

### Step 12: Music track and overrides (Days 33–34)
**Tasks**
1. One music track: in-point, base level, fade-in/out.
2. Auto-trim or loop (with short crossfade) to project length.
3. Manual gain override ranges (e.g. an extra dip across Scene 5).
4. UI: music panel with ducking sliders (depth, attack, release) and an overrides list.

**Done when:** music length equals project length, fades without clicks, and Scene 5 shows the extra dip in the measured gain curve.
**SRS:** FR-MUS-01/03/04.

### Step 13: Final mix, loudness, mux, verify (Days 35–37)
**Tasks**
1. Build the mix using the approach chosen in Step 2c.
2. Limiter at about −1 dBTP.
3. **Two-pass loudnorm** to −14 LUFS:
   - Pass 1 measures with `loudnorm=I=-14:TP=-1:LRA=11:print_format=json`.
   - Pass 2 applies the measured values.
4. Mux with video, `-movflags +faststart`, AAC audio.
5. Verification: duration, audio stream present, loudness within ±1 LU; show results in the UI.
6. Regression check: audio/video sync at three points (start, middle, end) within 1 frame.

**Done when:** the reference export plays with synced audio on a phone.
**SRS:** FR-MUS-05, FR-EXP-01, NFR-03.

### Step 14: Timeline lanes and draft render (Days 38–39)
**Tasks**
1. Timeline view: scene blocks, plus lanes for VO, SFX and music with waveforms and the ducking curve.
2. Draft render: 540×960 at lower quality for fast checks.
3. Warnings panel: VO overruns, missing assets, missing licenses.

**Gate G2 / Milestone M2:** the capybara Short renders with VO, captions, SFX and ducked music; draft render takes ≤ 45 s; final render ≤ 3 min on recommended hardware.
**SRS:** FR-TL-07, FR-PRV-04, NFR-01/02.

---

## Phase 3: Polish & Automation (≈ 16 days)

### Step 15: Transitions (Days 40–41)
**Tasks**
1. Transition interface (`type`, `duration`, `render(progress)`).
2. Implement `cut` (default), `flash`, `crossfade`, `dip-to-black`.
3. Overlap handled **inside** the scene boundary so total duration never changes.
4. UI: per-boundary dropdown; default Scene 8 → 9 flash in the reference template.

**Done when:** total frame count is unchanged with transitions enabled; no audio glitches.
**SRS:** FR-TRN-01…03.

### Step 16: Before/after template (Days 42–44)
**Tasks**
1. Template scene type with `left` and `right` sources, each either a new asset or `{fromScene: n}`.
2. Split-screen layout with divider style; slow zoom (e.g. 1.02 → 1.08).
3. Scene reference resolution in core (detect cycles, missing scenes).
4. UI: template picker and scene-reference selector.

**Done when:** Scene 10 uses Scene 1 and Scene 9 visuals without duplicating files.
**SRS:** FR-TPL-01/02.

### Step 17: Export presets, SRT, credits (Days 45–47)
**Tasks**
1. Presets: Shorts, Reels, TikTok, Facebook Reels (resolution, bitrate, max length warning).
2. Optional SRT export from captions; optional separate audio mix export.
3. **Credits file export:** gather license/attribution info from all audio assets into a ready-to-paste text file.
4. Pre-export check: block or warn on assets with missing/non-commercial license data.

**Done when:** exporting the reference project also produces `credits.txt` listing each audio asset's source and license.
**SRS:** FR-EXP-03/04/06, FR-AST-06/07.

### Step 18: Project templates, autosave, undo (Days 48–49)
**Tasks**
1. Save/load project as template (scene structure, timings, styles, audio settings).
2. Autosave plus rolling snapshots (last N); crash recovery prompt on restart.
3. Undo/redo through Immer patches in the store.
4. Schema `schemaVersion` plus migration scaffolding.

**Done when:** killing the server mid-edit loses at most a few seconds of work; undo/redo works across scene and audio edits.
**SRS:** FR-PRJ-03/05, NFR-04.

### Step 19: Plan import (Days 50–53)
**Tasks**
1. **Deterministic parser first:** extract the timeline table and per-scene "VOICEOVER / CAPTION / SFX" blocks by their headings and labels.
2. **LLM extraction** (Claude API): send the plan text with a strict JSON schema; validate the response with Zod; reject and retry on invalid output.
3. **Review screen:** shows extracted rows next to source text; the user edits and confirms before anything is applied.
4. Offline degradation: with no API key or no connection, run only the deterministic parser.
5. API key stored in a local config outside project files.
6. Test with the capybara document (expected: 10 scenes, 10 captions, 9 voiceover lines, SFX notes, transition rule).

**Done when:** importing the reference plan produces a draft project that needs only media attachment and minor corrections.
**SRS:** FR-IMP-01…05.

### Step 20: Hardening, docs, packaging, release (Days 54–56)
**Tasks**
1. Clear error messages for missing FFmpeg, unsupported formats, render failures.
2. First-run **setup check** (Node, FFmpeg, disk space, fonts).
3. User guide with the reference walkthrough; developer README; schema docs.
4. Package: start script (`pnpm start`) and an optional Dockerfile.
5. Full regression run: all unit, integration, output-verification and e2e tests.
6. Tag **v1.0**.

**Gate G3 / Milestone M3 (v1.0):** all SRS Section 11 acceptance criteria met, including "plan and media ready → exported video in under 10 minutes".

---

## Phase 4: Extensions (backlog, order by value)

| Priority | Item | SRS |
|---|---|---|
| 1 | Whisper auto-captions and word-by-word highlighting | FR-VO-07, FR-CAP-06 |
| 2 | TTS voiceover generation (pluggable provider) | FR-VO-06 |
| 3 | Batch render queue | FR-EXP-05 |
| 4 | SFX library with tags | FR-SFX-04 |
| 5 | Hardware (GPU) encoding option | NFR-01 |
| 6 | CTA end-card template | FR-TPL-03 |
| 7 | Docker image / hosted deployment | OQ-1 |

---

## Schedule Overview (full-time)

| Week | Steps | Gate |
|---|---|---|
| 1 | 1–2 (setup, spikes) | **G0** |
| 2 | 3–5 (core, composition, server) | |
| 3–4 | 6–7 (UI, render) | **G1 / M1** |
| 5 | 8–9 (audio core, captions) | |
| 6 | 10–12 (audio import, SFX, music) | |
| 7–8 | 13–14 (mix, timeline lanes) | **G2 / M2** |
| 9 | 15–17 (transitions, template, presets, credits) | |
| 10–11 | 18–20 (templates, plan import, release) | **G3 / M3 (v1.0)** |

*Part-time (2–3 hours per day): multiply calendar time by about 3, so roughly 8 months.*

---

## Progress Checklist

**Phase 0**
- [ ] Step 1: repo, CI, samples
- [ ] Step 2: spikes and ADRs → **G0**

**Phase 1**
- [ ] Step 3: core schema, timing, parser, fit
- [ ] Step 4: Remotion composition (visuals)
- [ ] Step 5: server, projects, assets
- [ ] Step 6: web UI v1
- [ ] Step 7: render service + CLI → **G1 / M1**

**Phase 2**
- [ ] Step 8: audio core and ducking
- [ ] Step 9: captions
- [ ] Step 10: audio import, auto-assign, license metadata
- [ ] Step 11: SFX and J-cuts
- [ ] Step 12: music and overrides
- [ ] Step 13: mix, loudnorm, mux, verify
- [ ] Step 14: timeline lanes, draft render → **G2 / M2**

**Phase 3**
- [ ] Step 15: transitions
- [ ] Step 16: before/after template
- [ ] Step 17: presets, SRT, credits export
- [ ] Step 18: project templates, autosave, undo
- [ ] Step 19: plan import
- [ ] Step 20: hardening, docs, packaging → **G3 / M3 (v1.0)**

---

## Risk Checkpoints During Development

| When | Check | Action if failing |
|---|---|---|
| End of Step 2 | Emoji captions, audio sync, frame accuracy proven | Use documented fallback; re-estimate |
| End of Step 7 | Render time for 30 s reference ≤ 3 min | Tune concurrency; lower default quality; consider FFmpeg path |
| End of Step 13 | Preview audio matches exported audio | Switch to the single audio source of truth (the FFmpeg mix) |
| End of Step 14 | Draft render ≤ 45 s | Reduce draft resolution/fps |
| Step 19 | LLM extraction accuracy on the reference plan | Strengthen deterministic parser; keep review screen mandatory |
