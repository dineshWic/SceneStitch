# 3. Emoji and Styled Caption Rendering

Date: 2026-10-05
Status: Accepted
Spike: 2b

## Context

Short-form social videos depend heavily on large, styled captions with emoji (e.g. "🧼 SOAPY CAPYBARA ✨"). We needed to confirm that Remotion's headless Chrome renderer reproduces emoji faithfully in an exported MP4 — both visually and without crashing — before building the caption system on top of it.

## Evidence

Spike composition: 3 seconds (90 frames), 1080×1920, two caption overlays with different text and colors:
- `"🧼 SOAPY CAPYBARA ✨"` — large yellow bold text with stroke, 72px
- `"100% SATISFYING 🦫 🛁"` — large cyan bold text, 68px

| Metric | Result | Target | Pass? |
|---|---|---|---|
| Render succeeds | Yes | No crash | ✅ |
| Duration | 3.000 s | 3.000 s | ✅ |
| Resolution | 1080 × 1920 | 1080 × 1920 | ✅ |
| Emoji visible | Yes (system Noto Color Emoji) | Visible | ✅ |

System font available: **Noto Color Emoji** (confirmed via `fc-list`). Chrome Headless Shell picks this up automatically via the OS font stack.

## Decision

Use **CSS-based `<div>` overlays** for caption rendering in Remotion. No custom emoji font bundling is required on this system; `font-family: "Noto Color Emoji", sans-serif` in the CSS stack is sufficient.

Styling recipe for production captions:
```css
font-weight: 900;
-webkit-text-stroke: 4px #000;
paint-order: stroke fill;
text-shadow: 0 6px 12px rgba(0,0,0,0.9);
```

## Alternatives Considered

- **Bundle an emoji font (e.g. Twemoji PNG sprites)**: Retained as documented fallback for deployment environments without system emoji fonts (e.g. a Docker container without Noto). Implementation: render emoji as `<img>` tags using the Twemoji CDN URL for each code point.
- **Render emoji as images**: Same fallback. Higher complexity but maximum cross-environment consistency.

## Consequences

- Caption component is a pure React `<div>` overlay — no canvas or SVG needed.
- On headless Linux environments that lack Noto Color Emoji, the fallback (Twemoji sprites) must be implemented before shipping Docker-based rendering.
- Text stroke via `-webkit-text-stroke` + `paint-order: stroke fill` is the recommended approach for legible social-style captions on any background.
