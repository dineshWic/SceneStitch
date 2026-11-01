# SceneStitch

Local video sequence assembler for images, clips, narration, captions, sound effects and ducked music. React editor and Remotion export share one composition; projects are JSON plus media on disk.

## Run

Install Node.js 22 LTS, pnpm (the version in `package.json`), and FFmpeg/ffprobe 6+ on PATH.

```sh
pnpm install
pnpm build
pnpm start
```

Open http://127.0.0.1:4000. For development, `pnpm dev` runs the API on port 4000 and Vite on http://127.0.0.1:5173. Build once before development so workspace packages resolve.

On the current Windows workspace, `powershell -ExecutionPolicy Bypass -File .\Start-SceneStitch.ps1` starts the built app using the portable verification tools. Add `-Build` to rebuild first.

Projects default to `~/.scenestitch/projects`. Set `SCENESTITCH_DATA_DIR` to choose another directory. Server binds to `127.0.0.1`; `PORT` overrides 4000. No cloud service is needed for editing or export.

Remotion downloads a headless Chromium runtime on first export. To use an existing Chrome/Chromium installation instead, set `SCENESTITCH_BROWSER_EXECUTABLE` to its executable path.

Exports reuse one browser for metadata and rendering and precompute music-ducking intervals. `SCENESTITCH_RENDER_CONCURRENCY` optionally selects an integer worker count up to the machine's available cores (default: up to four). Verification includes phase timings and the actual render profile. Draft uses half resolution when this produces even H.264 dimensions; unusual project dimensions retain full resolution. Draft encoding uses `ultrafast`; final uses `fast` at CRF 18.

Draft exports use smaller cached copies of referenced visuals under each project's `cache/draft/` folder. Cache keys include source size/modification time, output dimensions and fps. Audio, timing, originals and final-export media stay unchanged. Unused visuals are not processed. Removing the draft cache is safe when no export is active; the next draft recreates it.

## Assemble a video

1. Create a project. Set dimensions/fps in Project settings if needed.
2. Choose **Import plan / table**, paste a timeline, extract, review and apply. A simple table:

   ```text
   Time,Scene,Story beat
   0-2.2,1,Hook
   2.2-4.5,2,Reveal
   ```

3. Drop media into the library. `scene_01.mp4`, `vo_01.wav`, `sfx_01_pop.wav` automatically map to the first scene; other files can be assigned in the table or properties. Originals are preserved. Video working copies are H.264, constant fps and yuv420p.
4. Select each scene to set fit/crop, motion, caption, VO offset and SFX. Negative SFX offsets lead the cut. Use the Music panel for base gain, ducking, fades and time-range overrides. Inspect the warnings before export.
5. Use the preview and timeline to inspect boundaries. Safe zones appear only in the editor. Draft exports use half resolution; final exports use project dimensions.
6. Export MP4. Download the verified video, SRT, credits and audio mix. Job logs show rendering/normalization errors; cancel removes temporary video files.

Changes autosave after 650 ms. Twenty previous versions are kept on disk; **Saved versions** restores them. Browser recovery stores pending edits if saving was interrupted. Undo/redo keeps up to 100 changes within an editing session. Save template creates a new project with scene structure and styles, with media attachments cleared. Duplicate copies project media.

**Previous exports** in the export panel reopens saved results and failure logs after a reload or server restart. Running exports can be selected there to resume watching progress.

Shortcuts outside text inputs: Space/K playback, arrows frame step, J/L previous/next scene, Ctrl+Z/Y undo/redo, Ctrl+S save.

## Production plan import

Offline import accepts timeline tables and headings such as `## Scene 1` followed by `VOICEOVER:`, `CAPTION:` and `SFX:`. Extracted script and SFX notes are retained for review; attach real media afterward. Import never changes the project until **Apply reviewed scenes**.

Optional cloud extraction sends only the pasted plan, after enabling the checkbox. Set `ANTHROPIC_API_KEY` in the server environment and optionally `ANTHROPIC_MODEL`; keys are never included in project JSON. Provider failures or invalid responses fall back to the offline parser. Cloud output must pass the project schema.

## CLI and API

```sh
pnpm --filter @scenestitch/cli exec node dist/index.js render /path/to/project --draft
pnpm --filter @scenestitch/cli exec node dist/index.js render /path/to/project --final --output /path/to/output.mp4
```

Core REST routes: `GET/POST /projects`, `GET/PUT/DELETE /projects/:id`, `POST /projects/:id/assets` (multipart), `POST /projects/:id/render`, `GET /jobs/:id`, `POST /jobs/:id/cancel`. Poll progress every ~600 ms. Jobs run sequentially. Job records and completed verification results are saved atomically under the data directory's `.jobs/` folder and reloaded on startup. Interrupted exports are marked failed with a retry message and their incomplete files are removed. Cancelled waiting jobs are skipped; failures do not stop later exports. Media routes support HTTP byte ranges.

`POST /projects/:id/split-voiceover` takes `{assetId, segments:[{sceneId,start,end}], trimSilence?:boolean}`. It cuts a long narration into per-scene assets and optionally trims leading/trailing silence. Source files remain intact.

In the editor, expand an audio asset and choose **Split narration into scenes**. Enter one `start,end` line per scene; timestamps refer to the original narration file.

## Development

```sh
pnpm build
pnpm type-check
pnpm test
pnpm test:coverage
pnpm lint
pnpm format
```

Packages: `core` (Zod schema, timing/parser, fit, audio, workflow utilities), `composition` (shared visuals/captions/audio), `server` (storage, FFmpeg and render queue), `web` (editor), `cli` (headless rendering).

The core coverage command enforces at least 80% for lines, statements, functions and branches, locally and in CI. HTML and JSON summaries are written to `packages/core/coverage/`.

`node scripts/smoke-render.mjs` renders an eight-second synthetic fixture and writes verification results under `output/smoke-project`. With the production server running, `node scripts/smoke-ui.mjs` checks project creation, reviewed timeline import and autosave in a headless browser. Set `SCENESTITCH_BROWSER_EXECUTABLE` when using a local Chrome binary.

`node scripts/benchmark-render.mjs --draft --runs 2` constructs a synthetic ten-scene, 30-second reference fixture and records cold/warm timings. Use `--final` for 1080 × 1920 output, and `--label comparison` to keep separate result sets. Results, media, project JSON and exports are under `output/reference-benchmark/`. This exercises the reference timings and features with synthetic test media; it is not the original production footage or a user usability study.

See [development status](docs/Development_Status.md) for verified checks and remaining acceptance work. Phase 4 optional integrations are a separate backlog. Review Remotion licensing before commercial/team use.
