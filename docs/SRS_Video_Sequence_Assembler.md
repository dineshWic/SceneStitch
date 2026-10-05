# Software Requirements Specification & Development Plan
## Video Sequence Assembler (working title: **SceneStitch**)

| | |
|---|---|
| **Document version** | 0.1 (Draft) |
| **Date** | 2026-10-05 |
| **Author** | Dinesh |
| **Status** | For review |
| **Standard followed** | Structure based on IEEE 29148 / 830 (adapted for a small project) |

---

## Table of Contents
1. Introduction
2. Overall Description
3. Functional Requirements
4. External Interface Requirements
5. Non-Functional Requirements
6. System Architecture & Design
7. Development Plan
8. Testing & Quality Assurance
9. Risks & Mitigations
10. Deployment & Maintenance
11. Acceptance Criteria
12. Open Questions
- Appendix A: Project JSON Schema
- Appendix B: Reference Project (Capybara Salon Short)
- Appendix C: Glossary

---

## 1. Introduction

### 1.1 Purpose
This document specifies the requirements, architecture and development plan for a tool that **automatically assembles short vertical videos** (YouTube Shorts / Reels / TikTok style) from a set of images and video clips, a per-scene timeline, voiceover audio, captions, sound effects and background music.

The tool replaces a manual CapCut workflow in which an editor places each AI-generated clip on a timeline, adds captions, voiceover, SFX and music, ducks the music under narration, and exports a 9:16 MP4.

### 1.2 Scope
**In scope**
- Importing images, video clips and audio files.
- Defining a scene timeline (start/end per scene) in a table-style UI.
- Fitting each image/video to its scene duration.
- Placing voiceover, captions, SFX and music against the timeline.
- Automatic music ducking and loudness normalization.
- Hard-cut and simple transitions; a before/after split-screen template.
- Live preview and export to MP4 (H.264/AAC), default 1080×1920 @ 30 fps.
- Importing a written production plan (like the capybara document) to pre-fill the project.

**Out of scope (initial releases)**
- Generating images/videos (done in external AI tools).
- Full non-linear editing (multi-track free-form layering, keyframe curves, color grading).
- Publishing/uploading to platforms.
- Multi-user collaboration and cloud accounts.

### 1.3 Intended Audience
The developer (Dinesh), and any future contributor or reviewer of the project.

### 1.4 Definitions
See Appendix C.

### 1.5 References
- Reference production plan: "Capybara Salon" 30-second Short (summarized in Appendix B).
- FFmpeg documentation (filters: `xfade`, `loudnorm`, `atrim`, `setpts`).
- Remotion documentation (compositions, `<Player>`, rendering).
- Platform guidance for vertical-video safe zones (YouTube Shorts, Reels, TikTok).

### 1.6 Document Overview
Sections 2–5 describe *what* the system must do. Section 6 describes *how*. Section 7 is the development plan with phases, work breakdown and schedule. Sections 8–11 cover quality, risk, deployment and acceptance.

---

## 2. Overall Description

### 2.1 Product Perspective
A standalone, **local-first web application** (runs on the user's machine, opened in a browser). It uses a Node.js backend for file handling and rendering and a React front end for editing and preview. It can later be containerized and hosted without architectural change.

### 2.2 Product Functions (summary)
1. Manage projects and media assets.
2. Define scenes with exact time ranges.
3. Auto-fit visuals to scene length (trim / speed / loop / freeze / Ken Burns).
4. Add voiceover, captions, SFX per scene with offsets.
5. Add background music with automatic ducking.
6. Apply transitions and templates.
7. Preview in browser; export final MP4.
8. Import a text/markdown production plan to pre-fill scenes.

### 2.3 User Classes
| User | Description | Needs |
|---|---|---|
| **Creator (primary)** | Produces AI-generated short videos regularly | Fast assembly, repeatable results, minimal manual editing |
| **Developer/maintainer** | Same person, extending the tool | Clean data model, testable pipeline |

### 2.4 Operating Environment
- OS: Windows 10/11, macOS, or Linux.
- Runtime: Node.js LTS (≥ 20), FFmpeg ≥ 6 on PATH, a modern Chromium-based browser.
- Hardware: 4+ cores, 8 GB RAM minimum (16 GB recommended for 1080p rendering), ≥ 10 GB free disk.

### 2.5 Design & Implementation Constraints
- C-1: Final output must be H.264 video + AAC audio in an MP4 container for platform compatibility.
- C-2: All timings must be frame-accurate; no cumulative drift across scenes.
- C-3: Audio/music/SFX licensing is the user's responsibility; the tool only stores source metadata.
- C-4: The preview and the final render must use the same composition code to avoid mismatches.
- C-5: Remotion's license terms must be reviewed before any commercial/team use.

### 2.5.1 Assumptions and Dependencies
- A-1: Input visuals are supplied by the user (AI-generated or otherwise) and are already in 9:16 or can be cropped to it.
- A-2: Voiceover is supplied as audio files (per scene, or one file with timestamps) in the first phases; TTS is a later option.
- A-3: A single user operates the tool on a single machine.
- A-4: Internet access is only needed for optional features (plan import via Claude API, TTS, Whisper if cloud-based).

---

## 3. Functional Requirements

Priority: **M** = Must, **S** = Should, **C** = Could. Phase column refers to Section 7.

### 3.1 Project Management (FR-PRJ)
| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-PRJ-01 | The user can create, open, duplicate, rename and delete projects. | M | 1 |
| FR-PRJ-02 | A project is stored as one JSON file plus a media folder on disk (see Appendix A). | M | 1 |
| FR-PRJ-03 | Projects autosave on every change and keep the last N snapshots for undo/recovery. | S | 2 |
| FR-PRJ-04 | The user can set project settings: resolution, fps, aspect ratio (default 1080×1920, 30 fps). | M | 1 |
| FR-PRJ-05 | The user can save a project as a **template** (scene count, timings, caption style, audio settings) for reuse. | S | 3 |

### 3.2 Asset Management (FR-AST)
| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-AST-01 | Import images (JPG, PNG, WebP), videos (MP4, MOV, WebM) and audio (MP3, WAV, M4A) via drag-and-drop or file picker. | M | 1 |
| FR-AST-02 | On import, probe each file (duration, resolution, fps, rotation, audio presence) using ffprobe and store metadata. | M | 1 |
| FR-AST-03 | Generate thumbnails for images/videos and waveforms for audio. | S | 2 |
| FR-AST-04 | Normalize problem media on import (variable frame rate, rotation metadata, odd pixel formats) into a working copy; never modify the original. | M | 1 |
| FR-AST-05 | Auto-assign assets to scenes by filename pattern (e.g. `scene_01.*`, `vo_03.mp3`). | S | 2 |
| FR-AST-06 | The user can store a source/license note per audio asset. | C | 3 |

### 3.3 Timeline & Scenes (FR-TL)
| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-TL-01 | Scenes are defined in a table: scene number, start, end, story-beat label. | M | 1 |
| FR-TL-02 | The user can add, remove, reorder and edit scenes; durations are derived from start/end. | M | 1 |
| FR-TL-03 | The user can paste a timeline table (Markdown, CSV or tab-separated) to create all scenes at once. | M | 1 |
| FR-TL-04 | All times are converted to integer frame numbers at the project fps; the total duration equals the last scene's end frame exactly. | M | 1 |
| FR-TL-05 | The system validates the timeline: no gaps, no overlaps, increasing order; invalid rows are highlighted with a message. | M | 1 |
| FR-TL-06 | Editing a scene's end time can optionally **ripple** (shift) later scenes. | S | 2 |
| FR-TL-07 | A visual timeline shows scenes as blocks with audio lanes (VO, SFX, music) beneath. | S | 2 |

### 3.4 Visual Fitting (FR-VIS)
| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-VIS-01 | Each scene has one visual asset (image or video) or a template (see 3.10). | M | 1 |
| FR-VIS-02 | **Images:** hold for the scene duration; optional Ken Burns (zoom from/to, pan direction, easing). | M | 1 |
| FR-VIS-03 | **Videos:** fit policy selectable per scene: `trim` (choose in-point), `speed` (retime to fit), `loop`, `freeze-last`. | M | 1 |
| FR-VIS-04 | If a video is shorter than the scene, the system warns and applies the chosen policy; if longer, it trims from the chosen in-point. | M | 1 |
| FR-VIS-05 | The user can set the crop/scale mode: `cover` (fill, crop) or `contain` (letterbox with blurred background). | M | 1 |
| FR-VIS-06 | Speed adjustment is limited by a configurable range (default 0.5×–2×) with a warning outside it. | S | 2 |
| FR-VIS-07 | A global default fit policy and motion preset apply to new scenes. | S | 2 |

### 3.5 Voiceover (FR-VO)
| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-VO-01 | Each scene may have a voiceover clip with an offset from the scene start (default 0.1 s). | M | 2 |
| FR-VO-02 | Alternative input: one long VO file plus a list of timestamps; the system splits it per scene. | S | 2 |
| FR-VO-03 | The system measures each VO clip and **warns if it exceeds the scene duration** (or its remaining time after offset). | M | 2 |
| FR-VO-04 | Suggested fixes for overruns: slight speed-up (≤ 1.1×), trim silence at the tail, or flag for manual adjustment. | S | 2 |
| FR-VO-05 | Automatic silence trimming at the start/end of VO clips (configurable threshold). | S | 3 |
| FR-VO-06 | Optional TTS generation from script text via a pluggable provider. | C | 4 |
| FR-VO-07 | Optional speech-to-text (Whisper) to obtain word timings and auto-generate captions. | C | 4 |

### 3.6 Captions (FR-CAP)
| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-CAP-01 | Each scene may have a caption with text and a start offset (default 0.1–0.3 s) and end (default scene end). | M | 2 |
| FR-CAP-02 | Captions support emoji and render correctly in preview and export. | M | 2 |
| FR-CAP-03 | Caption style presets: font, size, color, stroke, shadow, background box, position, alignment, entrance animation (none/pop/fade). | M | 2 |
| FR-CAP-04 | A **safe-zone overlay** in the preview shows platform UI areas to avoid (bottom ~20 %, right side). | S | 2 |
| FR-CAP-05 | Auto-shrink long captions to fit within the safe width. | S | 2 |
| FR-CAP-06 | Optional word-by-word highlight captions driven by word timings. | C | 4 |

### 3.7 Sound Effects (FR-SFX)
| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-SFX-01 | Each scene may have zero or more SFX entries: asset, offset, volume (dB). | M | 2 |
| FR-SFX-02 | Offsets may be **negative** (relative to scene start) to create J-cuts, i.e. audio that leads the picture cut. | M | 2 |
| FR-SFX-03 | SFX can have fade-in/out durations. | S | 2 |
| FR-SFX-04 | A reusable SFX library (tagged files) for quick selection. | C | 4 |

### 3.8 Music & Mixing (FR-MUS)
| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-MUS-01 | One music track per project with in-point, fade-in, fade-out and base level (dB). | M | 2 |
| FR-MUS-02 | **Automatic ducking:** music level drops by a configurable amount (default −4 to −7 dB) while VO is active, with attack/release fades. | M | 2 |
| FR-MUS-03 | Manual gain overrides over a time range (e.g. extra dip during the brushing scene). | M | 2 |
| FR-MUS-04 | Music is trimmed/looped automatically to project length and faded out at the end. | M | 2 |
| FR-MUS-05 | The final mix is loudness-normalized (target about −14 LUFS integrated, true peak ≤ −1 dBTP). | M | 2 |
| FR-MUS-06 | Music "sections" (per time range mood/volume notes) are stored as metadata for reference. | C | 3 |

### 3.9 Transitions (FR-TRN)
| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-TRN-01 | Default transition between scenes is a hard cut. | M | 1 |
| FR-TRN-02 | Per-boundary override: `crossfade`, `dip-to-black`, `flash` (short white flash), with duration. | S | 3 |
| FR-TRN-03 | Transition durations are taken from within the scene boundary so the total duration is unchanged. | M | 3 |

### 3.10 Templates (FR-TPL)
| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-TPL-01 | A **before/after split-screen** scene template: left asset, right asset, divider style, optional slow zoom (e.g. 102 % → 108 %). | S | 3 |
| FR-TPL-02 | Template scenes may **reference another scene's asset** (e.g. Scene 1 and Scene 9) instead of a new file. | S | 3 |
| FR-TPL-03 | Optional end-card/CTA template (large caption + background). | C | 4 |

### 3.11 Preview (FR-PRV)
| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-PRV-01 | In-browser 9:16 player with play/pause, scrub, and per-scene jump. | M | 1 |
| FR-PRV-02 | Preview shows visuals; from Phase 2 also captions and audio. | M | 1–2 |
| FR-PRV-03 | Preview uses the same composition code as export. | M | 1 |
| FR-PRV-04 | A low-resolution **draft render** option for quick checks. | S | 2 |

### 3.12 Export (FR-EXP)
| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-EXP-01 | Export MP4 (H.264 + AAC) at project resolution/fps. | M | 1 |
| FR-EXP-02 | Show render progress, allow cancel, and report errors with a readable log. | M | 1 |
| FR-EXP-03 | Export presets: YouTube Shorts, Instagram Reels, TikTok, Facebook Reels (resolution, bitrate, max length). | S | 3 |
| FR-EXP-04 | Optional export of captions as an SRT file and the audio mix as a separate WAV/MP3. | C | 3 |
| FR-EXP-05 | Batch queue: render multiple projects sequentially. | C | 4 |

### 3.13 Plan Import (FR-IMP)
| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-IMP-01 | The user can paste or upload a production plan (Markdown/text). | S | 3 |
| FR-IMP-02 | The system extracts timeline rows, voiceover lines, captions, SFX notes, transition rules and music notes into a draft project JSON using an LLM (Claude API) with a strict JSON schema. | S | 3 |
| FR-IMP-03 | Extracted data is shown in a **review screen** for correction before being applied; nothing is applied silently. | S | 3 |
| FR-IMP-04 | Import works without internet in a degraded mode: only the timeline table is parsed with deterministic rules. | S | 3 |
| FR-IMP-05 | The API key is stored locally and never written into project files. | M | 3 |

---

## 4. External Interface Requirements

### 4.1 User Interface
- **Layout:** left panel (asset library), centre (9:16 preview), right panel (selected scene properties), bottom (scene table + timeline lanes).
- **Scene table** mirrors the user's existing planning table: Time | Scene | Story beat, with additional columns for asset, fit mode, caption, VO.
- **Keyboard shortcuts:** Space (play/pause), ←/→ (frame step), J/K/L (jump scenes), Ctrl+Z/Y (undo/redo), Ctrl+S (save snapshot).
- **Feedback:** inline validation, warnings for VO overruns and short clips, non-blocking toasts, blocking only for errors.
- **Accessibility:** full keyboard navigation for the scene table; sufficient contrast in the editor.

### 4.2 Software Interfaces
| Interface | Purpose |
|---|---|
| FFmpeg / ffprobe | Media probing, normalization, audio processing, loudness normalization |
| Remotion | Composition, preview player, frame rendering |
| Claude API (optional) | Plan import (Phase 3) |
| TTS / Whisper provider (optional) | Phase 4 |
| Local file system | Projects, media, caches, exports |

### 4.3 Hardware Interfaces
None beyond standard CPU/RAM/disk. GPU encoding (NVENC/VideoToolbox) is an optional optimization.

### 4.4 Communications
- Browser ↔ backend over HTTP (REST) and WebSocket (render progress), bound to `localhost` by default.
- Outbound HTTPS only for optional cloud features.

---

## 5. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | A 30 s 1080×1920 project renders in ≤ 3 minutes on the recommended hardware; the draft render in ≤ 45 seconds. |
| NFR-02 | Performance | Preview starts playback within 2 seconds and stays at ≥ 24 fps for a 10-scene project. |
| NFR-03 | Accuracy | Scene boundaries land on the exact planned frame; audio/video sync error ≤ 1 frame (≈ 33 ms) over a 60-second video. |
| NFR-04 | Reliability | Autosave must prevent loss of more than the last few seconds of work after a crash. |
| NFR-05 | Reliability | A failed or cancelled render leaves no corrupt output file and does not affect the project. |
| NFR-06 | Usability | A new project with 10 scenes can be created from a pasted table and imported media in under 5 minutes. |
| NFR-07 | Maintainability | Core timeline/audio logic lives in a framework-independent TypeScript package with ≥ 80 % unit-test coverage. |
| NFR-08 | Portability | Runs on Windows, macOS and Linux without code changes. |
| NFR-09 | Security | Server binds to localhost by default; uploaded file paths are sanitized; API keys are stored outside project files. |
| NFR-10 | Privacy | Media and projects never leave the machine unless the user uses an optional cloud feature. |
| NFR-11 | Extensibility | Visual fit modes, transitions and templates are plugin-style modules with a common interface. |
| NFR-12 | Observability | Render and import jobs produce structured logs retrievable from the UI. |

---

## 6. System Architecture & Design

### 6.1 High-Level Architecture

```
┌──────────────────────────── Browser (React + TypeScript) ───────────────────────────┐
│ Asset Library │ Scene Table / Timeline │ Properties Panel │ Remotion <Player> Preview │
└───────────────┬───────────────────────────────────────────────────────┬─────────────┘
                │ REST (projects, assets)         WebSocket (progress)   │
┌───────────────▼───────────────────────────────────────────────────────▼─────────────┐
│                         Node.js Backend (Fastify/Express)                           │
│  Project Service │ Asset Service │ Audio Service │ Render Service │ Import Service   │
└───────┬──────────────────┬───────────────────┬───────────────────┬──────────────────┘
        │                  │                   │                   │
   File system        ffprobe/FFmpeg      Remotion renderer     Claude API (opt.)
 (projects, media)   (probe, normalize,   (frames → video)
                      mix, loudnorm)
```

### 6.2 Component Responsibilities
| Component | Responsibility |
|---|---|
| **Core library (`@scenestitch/core`)** | Pure TypeScript: time→frame conversion, timeline validation, fit-policy calculation, ducking envelope, project schema (Zod). No I/O. |
| **Composition (`@scenestitch/composition`)** | Remotion React components: `SceneVisual`, `Caption`, `SplitScreen`, `Transition`, `AudioMix`. Used by both preview and renderer. |
| **Backend** | Project persistence, asset import/probe/normalize, render orchestration, import (LLM) jobs, WebSocket progress. |
| **Frontend** | Editing UI, validation feedback, preview, export dialog. |
| **CLI (`scenestitch render project.json`)** | Headless rendering for batch use and testing. |

### 6.3 Technology Stack
| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript (end-to-end) | One language for UI, core logic and rendering |
| UI | React + Vite + Tailwind | Fast development; Remotion is React-based |
| State | Zustand (or Redux Toolkit) + Immer | Simple undo/redo via patches |
| Video composition | Remotion | Emoji/CSS captions, split-screen, shared preview/render code |
| Media processing | FFmpeg / ffprobe | Industry standard for probing, normalization and audio |
| Backend | Node.js + Fastify | Lightweight, native fit with Remotion renderer |
| Validation | Zod | Schema shared by frontend, backend and CLI |
| Storage | JSON files + folders (SQLite optional for the asset index) | Human-readable, portable projects |
| Testing | Vitest, Playwright, ffprobe-based assertions | Unit, e2e and output verification |
| Packaging | pnpm workspaces monorepo; Docker optional | Clean separation of packages |

> **Note:** The developer's primary stack is Java/Spring Boot. A Spring Boot backend is feasible (calling FFmpeg through `ProcessBuilder` and invoking a Node renderer), but it adds a second runtime and a cross-language contract. This plan chooses all-TypeScript to minimize complexity; see Open Question OQ-1.

### 6.4 Data Model (summary)
Entities: **Project**, **Asset**, **Scene**, **VoiceoverClip**, **Caption**, **SfxEntry**, **MusicTrack**, **GainOverride**, **Transition**, **TemplateScene**. The full JSON structure is in Appendix A.

Key rules:
- Times in the file are stored in **seconds (decimal)** for readability, and converted to frames by the core library with a single, documented rounding rule: `frame = round(seconds × fps)`; each scene's end frame equals the next scene's start frame.
- Assets are referenced by ID; paths are relative to the project folder.

### 6.5 Render Pipeline
1. **Validate** project JSON (schema + timeline rules).
2. **Prepare media:** ensure normalized working copies exist (constant frame rate, correct orientation).
3. **Compute plan:** frames per scene, video retime factors, in-points, caption frame windows, SFX/VO absolute timestamps, ducking envelope.
4. **Render video frames** with Remotion (composition reads the computed plan).
5. **Build audio mix** (see 6.6). Either via Remotion `<Audio>` volume functions or an FFmpeg filter graph; the chosen approach must give identical results in preview and export.
6. **Loudness pass:** FFmpeg `loudnorm` (two-pass) to the target.
7. **Mux** video + audio into MP4 (`-movflags +faststart`).
8. **Verify** with ffprobe: duration, resolution, fps, audio presence; report to UI.

### 6.6 Audio Design

**Layers:** VO, SFX, Music.

**Ducking envelope algorithm (deterministic):**
1. Collect VO intervals `[t_start, t_end]` in absolute project time.
2. Merge intervals closer than a gap threshold (default 0.25 s) to avoid pumping.
3. Pad each merged interval by `attack` (default 0.15 s before) and `release` (default 0.35 s after).
4. Music gain = `baseDb` outside intervals, `baseDb + duckDb` inside, with linear-in-dB ramps over attack/release.
5. Apply manual `GainOverride` ranges on top (additive dB).
6. Evaluate per frame (or per audio sample block) and apply as a volume curve.

**J-cut support:** an SFX with a negative offset starts before the scene boundary; the mixer clamps at project start (t = 0).

**Final mix:** sum layers → limiter (−1 dBTP) → loudnorm.

### 6.7 Video Fit Calculations
Given scene duration `D` and source duration `S`:
- `trim`: play `[in, in + D]`; warn if `in + D > S`.
- `speed`: factor `r = S_used / D` where `S_used` is the selected source range; warn if `r` is outside the allowed range.
- `loop`: repeat source until `D`; optional crossfade at loop point.
- `freeze-last`: play to `S`, hold final frame until `D`.

### 6.8 Backend API (outline)
| Method & Path | Purpose |
|---|---|
| `GET/POST /projects` | List / create |
| `GET/PUT/DELETE /projects/:id` | Read / save / delete |
| `POST /projects/:id/assets` | Upload and probe asset |
| `POST /projects/:id/timeline/parse` | Parse pasted table into scenes |
| `POST /projects/:id/render` | Start render job (`draft` or `final`) |
| `GET /jobs/:id` / `DELETE /jobs/:id` | Status / cancel |
| `WS /jobs/:id/progress` | Progress events |
| `POST /import/plan` | Plan → draft project (Phase 3) |

### 6.9 Repository Layout
```
scenestitch/
  packages/
    core/            # schema, timing, fit, ducking (pure TS)
    composition/     # Remotion components
    server/          # Fastify API, render + media services
    web/             # React editor UI
    cli/             # headless render
  docs/              # this SRS, ADRs
  samples/           # reference project + sample media
```

---

## 7. Development Plan

### 7.1 Approach
- Iterative, with a working end-to-end vertical slice at the end of each phase.
- Trunk-based Git workflow; each requirement ID maps to issues/tasks.
- Architecture Decision Records (ADRs) for key choices (renderer, audio approach, schema).
- Effort is estimated in **working days for one developer working full time**. For part-time work (e.g. 2–3 hours/day), multiply the calendar duration by about 3.

### 7.2 Phases & Milestones

| Phase | Name | Goal | Est. effort | Exit milestone |
|---|---|---|---|---|
| **0** | Foundation & spikes | Prove the risky parts; set up the repo | 5 days | **M0:** spike results documented; monorepo builds |
| **1** | Visual assembler (MVP) | Table → timed silent video | 15 days | **M1:** a silent 30 s video assembled from the reference timeline |
| **2** | Audio & captions | VO, captions, SFX, music, ducking, loudness | 20 days | **M2:** full capybara Short assembled with sound and captions |
| **3** | Polish & automation | Transitions, templates, presets, plan import | 15 days | **M3:** plan document → draft project → export |
| **4** | Extensions | TTS, Whisper captions, batch, library | 10+ days | **M4:** optional features released |

Total to a usable v1.0 (Phases 0–3): **about 55 working days**.

### 7.3 Phase 0 — Foundation & Spikes (5 days)
| Task | Output |
|---|---|
| P0-1 Set up pnpm monorepo, TypeScript, lint, CI | Repo skeleton |
| P0-2 Spike: Remotion renders 3 clips + image with Ken Burns at 1080×1920 | Working sample + timing numbers |
| P0-3 Spike: emoji captions in Remotion render | Verified font/emoji approach |
| P0-4 Spike: audio mix with ducking + loudnorm, compare Remotion `<Audio>` vs FFmpeg filter graph | ADR choosing the audio approach |
| P0-5 Spike: frame-accuracy test (10 scenes → exact 30.000 s) | Test proving no drift |
| P0-6 Draft JSON schema (Zod) from Appendix A | `core` package v0 |

**Exit criteria:** the three highest risks (emoji captions, audio sync, frame accuracy) are resolved or have a documented fallback.

### 7.4 Phase 1 — Visual Assembler MVP (15 days)
| Task | Reqs | Days |
|---|---|---|
| P1-1 Core: time→frame, timeline validation, table parser | FR-TL-01..05 | 3 |
| P1-2 Core: video fit calculations (trim/speed/loop/freeze) | FR-VIS-03,04,06 | 2 |
| P1-3 Backend: project CRUD, asset import, ffprobe, normalization | FR-PRJ, FR-AST-01,02,04 | 3 |
| P1-4 Composition: `SceneVisual`, Ken Burns, cover/contain | FR-VIS-01,02,05 | 2 |
| P1-5 Frontend: asset library, scene table, properties panel | FR-TL, FR-VIS | 3 |
| P1-6 Preview player + render/export with progress | FR-PRV-01..03, FR-EXP-01,02 | 2 |

**Exit criteria (M1):** paste the 10-row timeline, drop in 10 assets, export a 30.000 s silent 1080×1920 MP4 whose cuts match the table to the frame.

### 7.5 Phase 2 — Audio & Captions (20 days)
| Task | Reqs | Days |
|---|---|---|
| P2-1 Core: VO placement, overrun detection, ducking envelope | FR-VO-01,03,04, FR-MUS-02,03 | 4 |
| P2-2 Composition: `Caption` with presets, emoji, safe-zone overlay | FR-CAP-01..05 | 4 |
| P2-3 Audio import: waveforms, VO splitting from timestamps | FR-AST-03, FR-VO-02 | 3 |
| P2-4 SFX with negative offsets and fades | FR-SFX-01..03 | 2 |
| P2-5 Music track: trim/loop/fade, manual gain overrides | FR-MUS-01,03,04 | 2 |
| P2-6 Final mix, limiter, loudnorm, mux, verification | FR-MUS-05, FR-EXP | 3 |
| P2-7 Timeline lanes UI (VO/SFX/music) and draft render | FR-TL-07, FR-PRV-04 | 2 |

**Exit criteria (M2):** the reference capybara project renders with VO, captions, SFX and music; music is audibly ducked under narration; loudness within ±1 LU of target.

### 7.6 Phase 3 — Polish & Automation (15 days)
| Task | Reqs | Days |
|---|---|---|
| P3-1 Transitions (flash, crossfade, dip) | FR-TRN | 2 |
| P3-2 Before/after split-screen template with scene references | FR-TPL-01,02 | 3 |
| P3-3 Export presets, SRT/audio export | FR-EXP-03,04 | 2 |
| P3-4 Project templates, filename auto-assignment | FR-PRJ-05, FR-AST-05 | 2 |
| P3-5 Plan import: deterministic table parser + LLM extraction + review screen | FR-IMP | 4 |
| P3-6 Hardening: error messages, crash recovery, docs | NFR-04,05,12 | 2 |

**Exit criteria (M3):** pasting the reference plan produces a populated draft project; after attaching media the user exports a finished Short with no manual timeline work.

### 7.7 Phase 4 — Extensions (backlog, ~10+ days)
TTS provider integration; Whisper auto-captions and word-highlight style; SFX library; batch render queue; GPU encoding; optional Docker/hosted deployment.

### 7.8 Indicative Schedule (full time, one developer)
| Week | Work |
|---|---|
| 1 | Phase 0 |
| 2–4 | Phase 1 → **M1** |
| 5–8 | Phase 2 → **M2** |
| 9–11 | Phase 3 → **M3** |
| 12+ | Phase 4 / maintenance |

### 7.9 Definition of Done (per task)
- Code merged with passing CI (lint, type-check, unit tests).
- Requirement ID(s) referenced in the commit/PR.
- Unit/integration tests added; manual check against the reference project.
- Docs updated if a schema or behavior changed.

### 7.10 Deliverables
1. Source repository with CI.
2. Documented project JSON schema and sample projects.
3. Installable/runnable app with setup guide (FFmpeg, Node).
4. CLI for headless rendering.
5. Test suite and the reference acceptance project.

---

## 8. Testing & Quality Assurance

| Level | Scope | Tools |
|---|---|---|
| **Unit** | Time→frame conversion, validation, fit calculations, ducking envelope, table/plan parsers | Vitest |
| **Integration** | Backend asset import + probe, render job lifecycle, schema migrations | Vitest + temp fixtures |
| **Output verification** | Render the reference project and assert with ffprobe: exact duration, resolution, fps, codecs, audio present; loudness measured with `ebur128` | Scripts in CI |
| **Visual regression** | Extract frames at scene boundaries and compare to golden images (tolerance) | Playwright / image diff |
| **End-to-end UI** | Create project → paste table → import assets → export | Playwright |
| **Performance** | Time the 30 s reference render and draft render; track in CI | Benchmark script |
| **Manual** | Listening test for ducking/J-cuts; check captions in safe zones on a real phone | Checklist |

**Key test cases**
- TC-1: 10 scenes with decimal boundaries (2.2, 4.5, 7.3…) → total exactly 900 frames at 30 fps.
- TC-2: Video shorter than scene → each fit policy behaves per 6.7.
- TC-3: VO longer than scene → warning with suggested fix.
- TC-4: Negative SFX offset on Scene 3 → audio leads cut by the specified amount.
- TC-5: Music ducks by configured dB under VO and returns afterwards without clicks.
- TC-6: Caption with emoji renders identically in preview and export.
- TC-7: Cancelling a render leaves no partial output.
- TC-8: Rotated/variable-frame-rate phone clip is normalized and plays in sync.

---

## 9. Risks & Mitigations

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Audio/video drift or sync issues | Medium | High | Fixed fps, frame-based math, Phase 0 spike, ffprobe checks in CI |
| R-2 | Remotion render slow for long/complex projects | Medium | Medium | Draft renders, concurrency tuning, optional GPU encoding, fallback to FFmpeg-only path for simple scenes |
| R-3 | Remotion licensing restrictions for commercial use | Low–Medium | High | Review license early (C-5); keep the composition layer isolated so it can be swapped |
| R-4 | Emoji/font rendering differences across machines | Medium | Medium | Bundle fonts, test in Phase 0 (P0-3), render emoji from a bundled set if required |
| R-5 | Preview diverges from final render | Medium | High | Shared composition code (C-4); golden-frame tests |
| R-6 | Odd input media (VFR, rotation, HDR, codecs) | High | Medium | Normalize on import; clear error messages; supported-format list |
| R-7 | Ducking sounds unnatural | Medium | Medium | Gap merging, attack/release tuning, manual overrides, listening tests |
| R-8 | LLM plan import extracts wrong data | Medium | Medium | Mandatory review screen; strict schema; deterministic fallback for the table |
| R-9 | Scope creep toward a full video editor | High | Medium | Keep Section 1.2 out-of-scope list; phase gates |
| R-10 | Music/SFX copyright problems | Medium | High | License metadata field; documentation; user responsibility |
| R-11 | Single-developer availability | Medium | Medium | Small phases with working slices; clear docs |

---

## 10. Deployment & Maintenance

- **Distribution (v1):** run from source or a packaged zip with a start script (`pnpm start`); prerequisites: Node.js and FFmpeg. A simple setup check screen verifies both.
- **Optional:** Docker image (Node + FFmpeg + fonts) for consistent rendering and later hosting.
- **Updates:** semantic versioning; project files carry a `schemaVersion` with migration functions.
- **Backups:** projects are plain folders; recommend version control or periodic copy.
- **Maintenance:** track FFmpeg/Remotion upgrades; keep render regression tests as a safety net.
- **Future hosting considerations (if ever needed):** authentication, per-user storage, job queue, object storage, resource limits.

---

## 11. Acceptance Criteria

The system is accepted for v1.0 when the **reference project** (Appendix B) can be produced as follows:

1. Paste the 10-row timeline table; the project shows 10 scenes totalling exactly 30.000 s.
2. Import 10 visuals (mix of images and videos) and the per-scene VO clips, SFX files and one music track.
3. Captions appear at the specified offsets with emoji, inside the safe zone.
4. Music is audibly lowered under VO (within the configured range) and recovers between lines; an extra manual dip is present for Scene 5.
5. Scene 8 → 9 uses a short flash; all other boundaries are hard cuts.
6. Scene 10 shows the before/after split (Scene 1 vs Scene 9 assets) with a slow zoom.
7. Export produces an MP4: 1080×1920, 30 fps, H.264/AAC, 30.0 s ±1 frame, loudness within ±1 LU of −14 LUFS.
8. Total hands-on time from "plan + media ready" to "exported video" is **under 10 minutes**, versus the manual CapCut baseline.
9. After Phase 3, importing the plan document pre-fills at least the timeline, captions and voiceover text correctly after review.

---

## 12. Open Questions

| ID | Question | Needed by |
|---|---|---|
| OQ-1 | Local-only tool, or hosted web app later? (Affects auth, storage, and whether Spring Boot is worthwhile.) | Phase 0 |
| OQ-2 | Will voiceover come as separate files per scene, one long file, or be generated by TTS? | Phase 2 |
| OQ-3 | Which output platforms must be supported first (Shorts, Reels, TikTok, Facebook)? | Phase 3 |
| OQ-4 | Is a single music track enough, or are per-section tracks needed? | Phase 2 |
| OQ-5 | Should the tool also support 16:9 and 1:1 outputs from the start? | Phase 1 |
| OQ-6 | Is commercial/team use planned (affects Remotion licensing)? | Phase 0 |

---

## Appendix A — Project JSON Schema (illustrative)

```json
{
  "schemaVersion": 1,
  "name": "Capybara Salon",
  "settings": { "width": 1080, "height": 1920, "fps": 30, "defaultFit": "trim" },
  "assets": [
    { "id": "a1", "type": "video", "path": "media/scene01.mp4", "duration": 8.0, "hasAudio": false },
    { "id": "a2", "type": "audio", "path": "media/vo_01.mp3", "duration": 2.1, "license": "own" }
  ],
  "scenes": [
    {
      "id": 1,
      "label": "Impossible-looking capybara salon hook",
      "start": 0.0,
      "end": 2.2,
      "visual": {
        "assetId": "a1",
        "fit": "trim",
        "inPoint": 0.5,
        "crop": "cover",
        "motion": { "zoomFrom": 1.0, "zoomTo": 1.05 }
      },
      "caption": { "text": "THIS ISN'T A DOG 😳", "offset": 0.0, "style": "bigBold" },
      "voiceover": { "assetId": "a2", "offset": 0.1 },
      "sfx": [ { "assetId": "a3", "offset": 0.0, "gainDb": -6 } ],
      "transitionIn": { "type": "cut" }
    },
    {
      "id": 10,
      "label": "Before/after + comment CTA",
      "start": 27.2,
      "end": 30.0,
      "template": {
        "type": "beforeAfter",
        "left": { "fromScene": 1 },
        "right": { "fromScene": 9 },
        "zoom": [1.02, 1.08]
      },
      "caption": { "text": "WOULD YOU GROOM HIM? 😂👇", "offset": 0.1, "style": "bigBold" }
    }
  ],
  "music": {
    "assetId": "m1",
    "baseDb": -18,
    "duckDb": -6,
    "attack": 0.15,
    "release": 0.35,
    "fadeOut": 1.5,
    "overrides": [ { "start": 10.1, "end": 13.0, "gainDb": -4 } ]
  },
  "transitions": [ { "between": [8, 9], "type": "flash", "duration": 0.12 } ],
  "export": { "preset": "shorts", "loudnessLufs": -14 }
}
```

---

## Appendix B — Reference Project Summary (Capybara Salon Short)

**Format:** 30 s vertical Short, 10 scenes, hard-cut editing, about 75 words of voiceover.

| Time | Scene | Story beat |
|---|---|---|
| 0.0–2.2 s | 1 | Impossible-looking capybara salon hook |
| 2.2–4.5 s | 2 | Muddy condition revealed |
| 4.5–7.3 s | 3 | Warm rinse begins |
| 7.3–10.1 s | 4 | Satisfying foam bath |
| 10.1–13.0 s | 5 | Gentle brush / mud removal |
| 13.0–16.1 s | 6 | Rinse reveal |
| 16.1–19.3 s | 7 | Blow-dry transformation |
| 19.3–22.3 s | 8 | Coat finishing + spa styling |
| 22.3–27.2 s | 9 | Full glamorous reveal |
| 27.2–30.0 s | 10 | Before/after + comment CTA |

**Per-scene elements the tool must support:** one visual (AI image or video), one VO line, one short caption (with emoji) at a defined offset, one or more SFX (some leading the cut), shared music with ducking 4–7 dB under narration, extra music dip during Scene 5, a flash transition between Scenes 8 and 9, a longest uninterrupted hero shot in Scene 9, and a split-screen end scene with slow zoom (102 % → 108 %).

**Editing rules captured from the plan:** mostly hard cuts; first 0.3 s hard cut into the subject with a slow ~105 % push; audio cues lead certain cuts; captions large and short; reveal shot given nearly 5 seconds.

---

## Appendix C — Glossary

| Term | Meaning |
|---|---|
| **Scene** | One timed segment of the video containing a single visual and its associated audio/caption |
| **Ken Burns** | Slow zoom/pan applied to a still image |
| **Fit policy** | How a video clip is adapted to a scene's duration (trim, speed, loop, freeze-last) |
| **J-cut** | Audio that starts before the picture cut to its scene |
| **Ducking** | Automatically lowering music volume while narration plays |
| **LUFS** | Loudness unit used to normalize overall audio level |
| **Safe zone** | Region of a vertical video not covered by platform UI elements |
| **Remotion** | React-based framework for creating videos programmatically |
| **FFmpeg / ffprobe** | Command-line tools for media processing and inspection |
| **SRS** | Software Requirements Specification |
