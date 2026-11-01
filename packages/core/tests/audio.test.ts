import { describe, expect, it } from 'vitest';
import {
  ProjectSchema,
  audioClips,
  musicDbAt,
  fadeGain,
  voiceoverIntervals,
  createMusicEnvelope,
} from '../src/index.js';
const project = () =>
  ProjectSchema.parse({
    name: 'Audio test',
    settings: {},
    assets: [
      { id: 'vo', type: 'audio', path: 'vo.wav', duration: 1 },
      { id: 'sfx', type: 'audio', path: 'sfx.wav', duration: 0.5 },
    ],
    scenes: [
      {
        id: 1,
        label: 'A',
        start: 0,
        end: 2,
        voiceover: { assetId: 'vo', offset: 0.5 },
        sfx: [{ assetId: 'sfx', offset: -0.2 }],
      },
      { id: 2, label: 'B', start: 2, end: 4, sfx: [{ assetId: 'sfx', offset: -0.2 }] },
    ],
    music: {
      assetId: 'music',
      baseDb: -18,
      duckDb: -6,
      attack: 0.2,
      release: 0.4,
      overrides: [{ start: 2, end: 3, gainDb: -3 }],
    },
  });
describe('Audio timing and ducking', () => {
  it('compiles an immutable envelope matching direct gain evaluation across the timeline', () => {
    const p = project();
    const envelope = createMusicEnvelope(p);
    for (let frame = 0; frame < 120; frame++)
      expect(envelope(frame / 30)).toBeCloseTo(musicDbAt(p, frame / 30));
    p.music!.baseDb = -30;
    expect(envelope(0)).toBe(-18);
    expect(createMusicEnvelope(p)(0)).toBe(-30);
    delete p.music;
    expect(createMusicEnvelope(p)(0)).toBe(-120);
  });
  it('trims negative-time audio without shifting its content', () => {
    const clips = audioClips(project());
    expect(clips[1]).toMatchObject({ start: 0, trimStart: 0.2, duration: 0.3 });
    expect(clips[2]).toMatchObject({ start: 1.8, trimStart: 0 });
  });
  it('ramps in dB with attack, release and manual overrides', () => {
    const p = project();
    expect(musicDbAt(p, 0)).toBe(-18);
    expect(musicDbAt(p, 0.4)).toBeCloseTo(-21);
    expect(musicDbAt(p, 1)).toBe(-24);
    expect(musicDbAt(p, 1.7)).toBeCloseTo(-21);
    expect(musicDbAt(p, 2.5)).toBe(-21);
    expect(musicDbAt(p, 3)).toBe(-18);
    expect(Math.abs(musicDbAt(p, 0.49999) - musicDbAt(p, 0.50001))).toBeLessThan(0.001);
  });
  it('merges nearby narration and handles zero-length fades', () => {
    const p = project();
    p.scenes[1]!.voiceover = { assetId: 'vo', offset: -0.4 };
    expect(voiceoverIntervals(p)).toEqual([{ start: 0.5, end: 2.6 }]);
    expect(fadeGain(0, 2, 0, 0)).toBe(1);
    expect(fadeGain(0.1, 2, 0.2, 0.2)).toBe(0.5);
    expect(fadeGain(1.9, 2, 0.2, 0.2)).toBeCloseTo(0.5);
  });
});
