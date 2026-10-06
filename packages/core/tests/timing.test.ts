import { describe, it, expect } from 'vitest';
import { toFrame, buildFrameTimeline, type Scene } from '../src/index.js';

describe('Timing Utilities', () => {
  it('converts seconds to frames accurately', () => {
    expect(toFrame(0.0, 30)).toBe(0);
    expect(toFrame(2.2, 30)).toBe(66);
    expect(toFrame(4.5, 30)).toBe(135);
    expect(toFrame(7.3, 30)).toBe(219);
    expect(toFrame(30.0, 30)).toBe(900);
  });

  it('builds frame timeline with contiguous boundary rule', () => {
    const scenes: Scene[] = [
      { id: 1, label: 'Scene 1', start: 0.0, end: 2.2 },
      { id: 2, label: 'Scene 2', start: 2.2, end: 4.5 },
      { id: 3, label: 'Scene 3', start: 4.5, end: 7.3 },
    ];

    const { computedScenes, totalFrames } = buildFrameTimeline(scenes, 30);

    expect(computedScenes.length).toBe(3);
    expect(computedScenes[0]?.startFrame).toBe(0);
    expect(computedScenes[0]?.endFrame).toBe(66);
    expect(computedScenes[0]?.durationInFrames).toBe(66);

    // Contiguous boundary rule: scene N startFrame === scene N-1 endFrame
    expect(computedScenes[1]?.startFrame).toBe(computedScenes[0]?.endFrame);
    expect(computedScenes[1]?.startFrame).toBe(66);
    expect(computedScenes[1]?.endFrame).toBe(135);

    expect(computedScenes[2]?.startFrame).toBe(computedScenes[1]?.endFrame);
    expect(computedScenes[2]?.startFrame).toBe(135);
    expect(computedScenes[2]?.endFrame).toBe(219);

    expect(totalFrames).toBe(219);
  });

  it('property test: for random valid boundaries, total frames equals Math.round(lastEnd * fps)', () => {
    const fps = 30;
    // Generate 100 random sets of contiguous scenes
    for (let testRun = 0; testRun < 100; testRun++) {
      const sceneCount = 1 + Math.floor(Math.random() * 20); // 1 to 20 scenes
      let currentStart = 0;
      const scenes: Scene[] = [];

      for (let i = 0; i < sceneCount; i++) {
        const duration = 0.5 + Math.random() * 5.0; // 0.5s to 5.5s
        const end = Math.round((currentStart + duration) * 10) / 10;
        scenes.push({
          id: i + 1,
          label: `Scene ${i + 1}`,
          start: currentStart,
          end,
        });
        currentStart = end;
      }

      const { computedScenes, totalFrames } = buildFrameTimeline(scenes, fps);
      const lastScene = scenes[scenes.length - 1]!;
      const expectedTotalFrames = Math.round(lastScene.end * fps);

      expect(totalFrames).toBe(expectedTotalFrames);

      // Verify contiguous boundaries across all scenes
      for (let i = 1; i < computedScenes.length; i++) {
        expect(computedScenes[i]?.startFrame).toBe(computedScenes[i - 1]?.endFrame);
      }
    }
  });
});
