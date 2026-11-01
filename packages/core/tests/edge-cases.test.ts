import { describe, expect, it } from 'vitest';
import {
  ProjectSchema,
  parseTime,
  parseTimeRange,
  parseTimelineTable,
  calculateFit,
  buildFrameTimeline,
  projectWarnings,
  resolveVisual,
  autoAssign,
  creditsText,
  captionsSrt,
  rippleEnd,
  projectTemplate,
  importPlan,
  audioClips,
  type FitPolicy,
} from '../src/index.js';
describe('Input boundaries and recovery diagnostics', () => {
  it('rejects malformed, nonfinite and negative times rather than partially parsing them', () => {
    for (const input of [
      '',
      'bad',
      '1secondxyz',
      '-1',
      'Infinity',
      '00:60',
      '-1:02',
      '01:-2',
      '1:2:3',
    ])
      expect(() => parseTime(input)).toThrow();
    expect(parseTime('01:02.5 seconds')).toBe(62.5);
    for (const input of ['0 to 2', '0~2', '0—2'])
      expect(parseTimeRange(input)).toEqual({ start: 0, end: 2 });
    for (const input of ['2-1', '1', '0--2']) expect(() => parseTimeRange(input)).toThrow();
  });
  it('supports quoted CSV, separate time columns, symbolic scene IDs and empty input', () => {
    expect(parseTimelineTable('Start,End,Story\n0,2,"Hello, world"').scenes[0]).toMatchObject({
      start: 0,
      end: 2,
      label: 'Hello, world',
    });
    expect(parseTimelineTable('Scene,Time,Story\nhook,0-2').scenes[0]).toMatchObject({
      id: 'hook',
      label: 'Scene hook',
    });
    expect(parseTimelineTable('0-2,1').scenes[0]?.label).toBe('Scene 1');
    expect(parseTimelineTable('\njust a note\n').scenes).toEqual([]);
    expect(parseTimelineTable('0,8broken,Beat').errors).toHaveLength(1);
    expect(buildFrameTimeline([]).totalFrames).toBe(0);
  });
  it('warns when a source in-point is exhausted and respects configurable speed limits', () => {
    for (const mode of ['speed', 'loop'] as const)
      expect(calculateFit(2, 1, mode, { inPoint: 2 }).warnings.join(' ')).toContain(
        'beyond source',
      );
    expect(calculateFit(10, 1, 'speed').warnings).toHaveLength(1);
    expect(calculateFit(1, 3, 'speed', { maxSpeed: 4 }).warnings).toEqual([]);
    expect(() => calculateFit(1, 1, 'unknown' as FitPolicy)).toThrow('Unsupported');
  });
  it('diagnoses missing media, duplicate IDs and scenes too short to render', () => {
    const p = ProjectSchema.parse({
      name: 'Broken',
      settings: {},
      music: { assetId: 'missing' },
      scenes: [
        {
          id: 1,
          label: 'A',
          start: 0,
          end: 0.001,
          voiceover: { assetId: 'missing' },
          sfx: [{ assetId: 'missing' }],
        },
        {
          id: 1,
          label: 'B',
          start: 0.001,
          end: 2,
          template: { type: 'split-screen', left: { fromScene: 'absent' } },
        },
      ],
      assets: [{ id: 'audio', type: 'audio', path: 'a.wav', commercialUse: false }],
    });
    const warnings = projectWarnings(p).join('\n');
    for (const text of [
      'Duplicate',
      'shorter than one frame',
      'missing visual',
      'missing voiceover',
      'missing SFX',
      'Missing music',
      'missing audio license',
      'non-commercial',
    ])
      expect(warnings).toContain(text);
    p.scenes[1]!.id = 2;
    expect(projectWarnings(p).join(' ')).toContain('Missing scene absent');
  });
  it('resolves direct split-screen sources and warns about retiming and short narration overruns', () => {
    const p = ProjectSchema.parse({
      name: 'Plan',
      settings: {},
      export: { preset: 'facebook' },
      assets: [
        { id: 'image', type: 'image', path: 'i.png' },
        { id: 'video', type: 'video', path: 'v.mp4', duration: 20 },
        {
          id: 'vo',
          type: 'audio',
          path: 'vo.wav',
          duration: 2.05,
          license: 'CC0',
          commercialUse: true,
        },
      ],
      scenes: [
        {
          id: 1,
          label: 'A',
          start: 0,
          end: 2,
          visual: { assetId: 'video', fit: 'speed' },
          voiceover: { assetId: 'vo', offset: 0 },
        },
        {
          id: 2,
          label: 'Split',
          start: 2,
          end: 100,
          template: { type: 'split-screen', left: { assetId: 'image' }, right: { fromScene: 1 } },
        },
      ],
    });
    expect(resolveVisual(p, 2, 'left')?.id).toBe('image');
    expect(resolveVisual(p, 2, 'right')?.id).toBe('video');
    const warnings = projectWarnings(p).join(' ');
    expect(warnings).toContain('Extreme playback');
    expect(warnings).toContain('slight speed-up');
    expect(warnings).toContain('preset duration');
    p.scenes[0]!.template = { type: 'split-screen', left: { fromScene: 1 } };
    expect(projectWarnings(p).join(' ')).toContain('Circular');
  });
  it('does not duplicate auto-assigned SFX or attach unrelated/mismatched media', () => {
    const p = ProjectSchema.parse({
      name: 'Names',
      settings: {},
      scenes: [{ id: 'one', label: 'A', start: 0, end: 3 }],
      assets: [
        { id: 'image', type: 'image', path: 'scene_01.png' },
        { id: 'vo', type: 'audio', name: 'VO_01.wav', path: 'a.wav' },
        { id: 'sfx', type: 'audio', name: 'sfx_01_pop.wav', path: 's.wav' },
        { id: 'other', type: 'audio', path: 'unrelated.wav' },
        { id: 'outside', type: 'image', path: 'scene_90.png' },
        { id: 'wrong', type: 'audio', path: 'scene_01.wav' },
      ],
    });
    const assigned = autoAssign(autoAssign(p));
    expect(assigned.scenes[0]).toMatchObject({
      visual: { assetId: 'image' },
      voiceover: { assetId: 'vo' },
      sfx: [{ assetId: 'sfx' }],
    });
    expect(assigned.scenes[0]?.sfx).toHaveLength(1);
    expect(audioClips(assigned)).toEqual([]); // Missing source durations must not create phantom audio.
    expect(rippleEnd(assigned.scenes, 99, 4)).toEqual(assigned.scenes);
  });
  it('preserves reusable mix settings while clearing template media and exports usable credits', () => {
    const p = ProjectSchema.parse({
      name: 'Template',
      settings: {},
      music: { assetId: 'a' },
      assets: [
        {
          id: 'a',
          type: 'audio',
          path: 'a.wav',
          name: 'Track',
          source: 'Creator',
          license: 'CC0',
          licenseUrl: 'https://example.com/license',
          commercialUse: true,
        },
        { id: 'b', type: 'audio', path: 'b.wav', commercialUse: false },
        { id: 'c', type: 'audio', path: 'c.wav' },
      ],
      scenes: [
        {
          id: 1,
          label: 'A',
          start: 0,
          end: 3,
          caption: { text: 'Hello', offset: 0, end: 1 },
          voiceover: { assetId: 'a' },
          sfx: [{ assetId: 'a' }],
          template: { type: 'split-screen', left: { assetId: 'a' }, right: { assetId: 'a' } },
        },
      ],
    });
    const template = projectTemplate(p);
    expect(template.music?.baseDb).toBe(-18);
    expect(template.music?.assetId).toBe('');
    expect(template.scenes[0]?.voiceover?.assetId).toBe('');
    expect(template.scenes[0]?.sfx?.[0]?.assetId).toBe('');
    expect(template.scenes[0]?.template?.right?.assetId).toBe('');
    const credits = creditsText(p);
    for (const text of ['Creator', 'CC0', 'Not supplied', 'Yes', 'No', 'Unspecified'])
      expect(credits).toContain(text);
    expect(captionsSrt(p)).toContain('00:00:01,000');
    expect(importPlan('|Time|Scene|Beat|\n|bad|1|Broken|').notes).toHaveLength(1);
  });
  it('ignores invalid audio assignments and clamps clips beyond the project', () => {
    const p = ProjectSchema.parse({
      name: 'Audio',
      settings: {},
      assets: [
        { id: 'image', type: 'image', path: 'i.png' },
        { id: 'audio', type: 'audio', path: 'a.wav', duration: 5 },
      ],
      scenes: [
        {
          id: 1,
          label: 'A',
          start: 0,
          end: 2,
          voiceover: { assetId: 'image' },
          sfx: [
            { assetId: 'missing' },
            { assetId: 'audio', offset: 3 },
            { assetId: 'audio', offset: -0.5, fadeIn: 0.1, fadeOut: 0.2 },
          ],
        },
      ],
    });
    expect(audioClips(p)).toEqual([
      expect.objectContaining({ start: 0, trimStart: 0.5, duration: 2, fadeIn: 0.1, fadeOut: 0.2 }),
    ]);
  });
});
