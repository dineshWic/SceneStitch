import { describe, it, expect } from 'vitest';
import { ProjectSchema, SceneSchema, AssetSchema } from '../src/index.js';

describe('Zod Schemas', () => {
  it('validates a valid Scene object', () => {
    const sceneData = {
      id: 1,
      label: 'Hook Scene',
      start: 0.0,
      end: 2.2,
      visual: {
        assetId: 'a1',
        fit: 'trim' as const,
        inPoint: 0.5,
      },
      caption: {
        text: 'THIS ISN\'T A DOG 😳',
        offset: 0.0,
      },
    };

    const parsed = SceneSchema.parse(sceneData);
    expect(parsed.id).toBe(1);
    expect(parsed.start).toBe(0.0);
    expect(parsed.end).toBe(2.2);
    expect(parsed.visual?.fit).toBe('trim');
  });

  it('validates a valid Project object', () => {
    const projectData = {
      name: 'Capybara Salon',
      settings: { width: 1080, height: 1920, fps: 30, defaultFit: 'trim' as const },
      assets: [
        { id: 'a1', type: 'video' as const, path: 'media/clip01.mp4', duration: 5.0 },
      ],
      scenes: [
        { id: 1, label: 'Scene 1', start: 0.0, end: 2.2 },
      ],
    };

    const parsed = ProjectSchema.parse(projectData);
    expect(parsed.name).toBe('Capybara Salon');
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.scenes.length).toBe(1);
  });

  it('fails validation on invalid asset type', () => {
    const invalidAsset = {
      id: 'a1',
      type: 'unknown-type',
      path: 'media/test.mp4',
    };

    expect(() => AssetSchema.parse(invalidAsset)).toThrow();
  });
});
