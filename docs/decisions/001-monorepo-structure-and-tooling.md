# 1. Monorepo Structure and Tooling

Date: 2026-10-05
Status: Accepted

## Context
SceneStitch is a local-first vertical video sequence assembler requiring clean separation between pure domain timeline math, Remotion compositions, backend file management/FFmpeg orchestration, web user interface, and CLI execution.

To satisfy SRS non-functional requirements (NFR-07 maintainability, NFR-08 portability) and Rule 2 (packages/core must be pure TypeScript with no I/O, no Node/DOM APIs), we need a modular repository structure that enforces package boundaries, supports fast isolated testing, and shares code seamlessly.

## Decision
1. Organize the repository as a **pnpm workspaces monorepo** with five packages:
   - `packages/core`: Pure TypeScript business logic (schema, timeline conversion, validation, fit math, ducking envelopes). Zero I/O, Node, or DOM dependencies.
   - `packages/composition`: Remotion React components and compositions for video rendering and browser preview.
   - `packages/server`: Fastify-based local REST API and WebSocket server for asset probing/normalization, project storage, and render dispatch.
   - `packages/web`: React + Vite frontend editor with Zustand state management.
   - `packages/cli`: Headless CLI entrypoint for batch rendering and CI verification.
2. Use **TypeScript with strict settings** (`tsconfig.base.json`), target `ES2022`, module resolution `NodeNext`.
3. Use **Vitest** for fast unit testing across packages.
4. Use **ESLint 9** (flat config) and **Prettier** for static analysis and formatting consistency, forbidding `any` types.
5. Setup automated GitHub Actions CI workflow executing lint, format check, type check, build, and unit tests.

## Alternatives Considered
- **Single monolithic package**: Rejected because it risks leaking Node.js and DOM dependencies into core timeline calculations, violating Rule 2 and making composition code harder to share cleanly between preview and export.
- **npm / yarn workspaces**: Rejected because pnpm provides faster symlinked installs, strict isolation against phantom dependencies, and unified lockfile integrity.

## Consequences
- Clean separation of concerns with explicit inter-package dependencies via `workspace:*`.
- Fast, reproducible local and CI builds.
- Clear contract boundaries facilitating independent testing of each layer.
