import { describe, it, expect } from 'vitest';
import {
  buildFrameTimeline,
  parseTimelineTable,
  type Project,
} from '@scenestitch/core';
import { calculateProjectMetadata } from '../src/index.js';

const CAPYBARA_TIMELINE = `
| Time | Scene | Story beat |
|---|---|---|
| 0.0–2.2 s | 1 | Hook |
| 2.2–4.5 s | 2 | Muddy |
| 4.5–7.3 s | 3 | Warm rinse |
| 7.3–10.1 s | 4 | Foam bath |
| 10.1–13.0 s | 5 | Brush |
| 13.0–16.1 s | 6 | Rinse reveal |
| 16.1–19.3 s | 7 | Blow dry |
| 19.3–22.3 s | 8 | Styling |
| 22.3–27.2 s | 9 | Glamour reveal |
| 27.2–30.0 s | 10 | Before/after CTA |
`;

describe('Composition Boundary Stills Check (Step 4)', () => {
  it('calculates dynamic metadata correctly for reference project', async () => {
    const { scenes } = parseTimelineTable(CAPYBARA_TIMELINE);
    const project: Project = {
      schemaVersion: 1,
      name: 'Capybara Test Project',
      settings: { width: 1080, height: 1920, fps: 30, defaultFit: 'trim' },
      assets: [],
      scenes,
    };

    const metadata = await calculateProjectMetadata({
      props: { project },
      defaultProps: { project },
      abortSignal: new AbortController().signal,
      compositionId: 'SceneStitchMain',
      isRendering: false,
    });

    expect(metadata.durationInFrames).toBe(900);
    expect(metadata.fps).toBe(30);
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1920);
  });

  it('verifies exact scene ownership at every boundary frame without gaps or overlaps', () => {
    const { scenes } = parseTimelineTable(CAPYBARA_TIMELINE);
    const { computedScenes, totalFrames } = buildFrameTimeline(scenes, 30);

    expect(totalFrames).toBe(900);
    expect(computedScenes.length).toBe(10);

    // Build frame lookup map for frames 0 to 899
    const frameSceneMap = new Map<number, number | string>();

    for (const cs of computedScenes) {
      for (let f = cs.startFrame; f < cs.endFrame; f++) {
        expect(frameSceneMap.has(f)).toBe(false); // No overlap allowed
        frameSceneMap.set(f, cs.sceneId);
      }
    }

    // Verify all 900 frames are assigned to a scene (no black / empty frames)
    for (let f = 0; f < 900; f++) {
      expect(frameSceneMap.has(f)).toBe(true);
    }

    // Verify cut boundaries
    // Scene 1 -> 2 boundary at frame 66
    expect(frameSceneMap.get(65)).toBe(1);
    expect(frameSceneMap.get(66)).toBe(2);

    // Scene 2 -> 3 boundary at frame 135
    expect(frameSceneMap.get(134)).toBe(2);
    expect(frameSceneMap.get(135)).toBe(3);

    // Scene 3 -> 4 boundary at frame 219
    expect(frameSceneMap.get(218)).toBe(3);
    expect(frameSceneMap.get(219)).toBe(4);

    // Scene 4 -> 5 boundary at frame 303
    expect(frameSceneMap.get(302)).toBe(4);
    expect(frameSceneMap.get(303)).toBe(5);

    // Scene 5 -> 6 boundary at frame 390
    expect(frameSceneMap.get(389)).toBe(5);
    expect(frameSceneMap.get(390)).toBe(6);

    // Scene 6 -> 7 boundary at frame 483
    expect(frameSceneMap.get(482)).toBe(6);
    expect(frameSceneMap.get(483)).toBe(7);

    // Scene 7 -> 8 boundary at frame 579
    expect(frameSceneMap.get(578)).toBe(7);
    expect(frameSceneMap.get(579)).toBe(8);

    // Scene 8 -> 9 boundary at frame 669
    expect(frameSceneMap.get(668)).toBe(8);
    expect(frameSceneMap.get(669)).toBe(9);

    // Scene 9 -> 10 boundary at frame 816
    expect(frameSceneMap.get(815)).toBe(9);
    expect(frameSceneMap.get(816)).toBe(10);

    // Final frame 899 belongs to scene 10
    expect(frameSceneMap.get(899)).toBe(10);
  });
});
