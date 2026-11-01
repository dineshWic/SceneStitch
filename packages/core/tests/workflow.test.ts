import { describe, expect, it } from 'vitest';
import {
  ProjectSchema,
  autoAssign,
  captionsSrt,
  importPlan,
  projectWarnings,
  resolveVisual,
  rippleEnd,
  projectTemplate,
} from '../src/index.js';
describe('Project workflows', () => {
  it('imports a plan for review without inventing assets', () => {
    const { project } = importPlan(
      '| Time | Scene | Beat |\n|---|---|---|\n|0-2|1|Hook|\n|2-4|2|Reveal|\n## Scene 1\nVOICEOVER: Hello\nCAPTION: Hi 👋\nSFX: pop',
    );
    expect(project.scenes).toHaveLength(2);
    expect(project.scenes[0]).toMatchObject({
      script: 'Hello',
      caption: { text: 'Hi 👋' },
      sfxNotes: 'pop',
    });
    expect(project.assets).toEqual([]);
    expect(captionsSrt(project)).toContain('00:00:00,100 --> 00:00:02,000');
  });
  it('assigns named media, ripples edits and clears template media', () => {
    const p = ProjectSchema.parse({
      name: 'Test',
      settings: {},
      scenes: [
        { id: 1, label: 'A', start: 0, end: 2 },
        { id: 2, label: 'B', start: 2, end: 4 },
      ],
      assets: [
        { id: 'a', name: 'scene_01.png', type: 'image', path: 'a.png' },
        { id: 'v', name: 'vo_02.wav', type: 'audio', path: 'v.wav', duration: 3 },
      ],
    });
    const assigned = autoAssign(p);
    expect(assigned.scenes[0]?.visual?.assetId).toBe('a');
    expect(assigned.scenes[1]?.voiceover?.assetId).toBe('v');
    expect(rippleEnd(assigned.scenes, 0, 3)[1]).toMatchObject({ start: 3, end: 5 });
    expect(projectWarnings(assigned).some((w) => /voiceover exceeds/.test(w))).toBe(true);
    expect(projectTemplate(assigned).assets).toEqual([]);
    expect(p.scenes[0]?.visual).toBeUndefined();
  });
  it('detects circular and missing template references', () => {
    const p = ProjectSchema.parse({
      name: 'Test',
      settings: {},
      scenes: [
        {
          id: 1,
          label: 'A',
          start: 0,
          end: 2,
          template: { type: 'split-screen', left: { fromScene: 1 } },
        },
      ],
    });
    expect(() => resolveVisual(p, 1)).toThrow('Circular');
    expect(() => resolveVisual(p, 5)).toThrow('Missing');
  });
});
