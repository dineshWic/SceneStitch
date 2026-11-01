import type { Project } from './schema.js';

export const dbToGain = (db: number): number => 10 ** (db / 20);
export interface AudioClip {
  assetId: string;
  start: number;
  duration: number;
  trimStart: number;
  gainDb: number;
  playbackRate: number;
  fadeIn: number;
  fadeOut: number;
  kind: 'voiceover' | 'sfx';
}
export function audioClips(project: Project): AudioClip[] {
  const total = project.scenes.at(-1)?.end ?? 0;
  return project.scenes.flatMap((scene) => {
    const entries = [
      ...(scene.voiceover ? [{ ...scene.voiceover, kind: 'voiceover' as const }] : []),
      ...(scene.sfx ?? []).map((sfx) => ({ ...sfx, kind: 'sfx' as const })),
    ];
    return entries.flatMap((entry) => {
      const asset = project.assets.find((a) => a.id === entry.assetId);
      if (!asset || asset.type !== 'audio') return [];
      const rate = 'playbackRate' in entry ? (entry.playbackRate ?? 1) : 1;
      const rawStart = scene.start + entry.offset;
      const start = Math.max(0, rawStart);
      const trimStart = Math.max(0, -rawStart) * rate;
      const duration = Math.min(total - start, ((asset.duration ?? 0) - trimStart) / rate);
      if (duration <= 0) return [];
      return [
        {
          assetId: asset.id,
          start,
          duration,
          trimStart,
          playbackRate: rate,
          gainDb: entry.gainDb ?? 0,
          kind: entry.kind,
          fadeIn: 'fadeIn' in entry ? (entry.fadeIn ?? 0) : 0,
          fadeOut: 'fadeOut' in entry ? (entry.fadeOut ?? 0) : 0,
        },
      ];
    });
  });
}
export function voiceoverIntervals(project: Project): Array<{ start: number; end: number }> {
  const intervals = audioClips(project)
    .filter((c) => c.kind === 'voiceover')
    .map((c) => ({ start: c.start, end: c.start + c.duration }))
    .sort((a, b) => a.start - b.start);
  const merged: typeof intervals = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (previous && interval.start - previous.end < 0.25)
      previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}
export function musicDbAt(project: Project, time: number): number {
  return createMusicEnvelope(project)(time);
}
/** Compile intervals once for per-frame gain callbacks in preview and export. */
export function createMusicEnvelope(project: Project): (time: number) => number {
  const music = project.music;
  if (!music) return () => -120;
  const intervals = voiceoverIntervals(project);
  const { attack, release, baseDb, duckDb } = music;
  const overrides = (music.overrides ?? []).map((o) => ({ ...o }));
  return (time) => {
    let depth = 0;
    for (const interval of intervals) {
      let amount = 0;
      if (time >= interval.start && time <= interval.end) amount = 1;
      else if (attack > 0 && time >= interval.start - attack && time < interval.start)
        amount = (time - interval.start + attack) / attack;
      else if (release > 0 && time > interval.end && time < interval.end + release)
        amount = 1 - (time - interval.end) / release;
      depth = Math.max(depth, amount);
    }
    const override = overrides
      .filter((o) => time >= o.start && time < o.end)
      .reduce((sum, o) => sum + o.gainDb, 0);
    return baseDb + duckDb * depth + override;
  };
}
export function fadeGain(time: number, duration: number, fadeIn = 0, fadeOut = 0): number {
  return Math.max(
    0,
    Math.min(1, fadeIn ? time / fadeIn : 1, fadeOut ? (duration - time) / fadeOut : 1),
  );
}
