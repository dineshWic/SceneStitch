import { ProjectSchema, type Project, type Scene, type Asset } from './schema.js';
import { parseTimelineTable } from './parser.js';
import { validateTimeline } from './validator.js';
import { calculateFit } from './fit.js';

export const EXPORT_PRESETS = {
  shorts: { width: 1080, height: 1920, maxSeconds: 180, bitrate: '8M' },
  reels: { width: 1080, height: 1920, maxSeconds: 180, bitrate: '8M' },
  tiktok: { width: 1080, height: 1920, maxSeconds: 600, bitrate: '8M' },
  facebook: { width: 1080, height: 1920, maxSeconds: 90, bitrate: '8M' },
} as const;

export function resolveVisual(
  project: Project,
  sceneId: Scene['id'],
  side?: 'left' | 'right',
  visited = new Set<string>(),
): Asset | undefined {
  const key = `${sceneId}:${side ?? 'visual'}`;
  if (visited.has(key)) throw new Error(`Circular scene reference: ${sceneId}`);
  visited.add(key);
  const scene = project.scenes.find((s) => String(s.id) === String(sceneId));
  if (!scene) throw new Error(`Missing scene ${sceneId}`);
  const source = side ? scene.template?.[side] : undefined;
  if (source?.fromScene !== undefined)
    return resolveVisual(project, source.fromScene, undefined, visited);
  if (!side && scene.template) return resolveVisual(project, sceneId, 'left', visited);
  const id = source?.assetId ?? (!side ? scene.visual?.assetId : undefined);
  return project.assets.find((a) => a.id === id);
}
export function projectWarnings(project: Project): string[] {
  const warnings = validateTimeline(project.scenes).map((e) => e.message);
  const ids = new Set<string>();
  for (const scene of project.scenes) {
    if (ids.has(String(scene.id))) warnings.push(`Duplicate scene ID ${scene.id}`);
    ids.add(String(scene.id));
    if (
      Math.round(scene.end * project.settings.fps) <= Math.round(scene.start * project.settings.fps)
    )
      warnings.push(`Scene ${scene.id} is shorter than one frame`);
    try {
      for (const side of scene.template ? (['left', 'right'] as const) : [undefined]) {
        const asset = resolveVisual(project, scene.id, side);
        if (!asset || asset.type === 'audio')
          warnings.push(`Scene ${scene.id}: missing visual ${side ?? ''}`);
        else if (asset.type === 'video') {
          warnings.push(
            ...calculateFit(scene.end - scene.start, asset.duration ?? 0, scene.visual?.fit, {
              inPoint: scene.visual?.inPoint,
              minSpeed: project.settings.minSpeed,
              maxSpeed: project.settings.maxSpeed,
            }).warnings.map((w) => `Scene ${scene.id}: ${w}`),
          );
        }
      }
    } catch (error) {
      warnings.push((error as Error).message);
    }
    if (scene.voiceover) {
      const asset = project.assets.find((a) => a.id === scene.voiceover?.assetId);
      if (!asset || asset.type !== 'audio')
        warnings.push(`Scene ${scene.id}: missing voiceover asset`);
      else {
        const available = scene.end - scene.start - scene.voiceover.offset;
        const duration = (asset.duration ?? 0) / (scene.voiceover.playbackRate ?? 1);
        if (duration > available)
          warnings.push(
            `Scene ${scene.id}: voiceover exceeds scene by ${(duration - available).toFixed(2)}s. ${duration / available <= 1.1 ? 'Try a slight speed-up (up to 1.1x).' : 'Trim tail silence or adjust manually.'}`,
          );
      }
    }
    for (const sfx of scene.sfx ?? [])
      if (!project.assets.some((a) => a.id === sfx.assetId && a.type === 'audio'))
        warnings.push(`Scene ${scene.id}: missing SFX asset`);
  }
  if (
    project.music &&
    !project.assets.some((a) => a.id === project.music?.assetId && a.type === 'audio')
  )
    warnings.push('Missing music asset');
  for (const asset of project.assets.filter((a) => a.type === 'audio')) {
    if (!asset.license) warnings.push(`${asset.name ?? asset.id}: missing audio license`);
    if (asset.commercialUse === false)
      warnings.push(`${asset.name ?? asset.id}: non-commercial license`);
  }
  const preset = EXPORT_PRESETS[project.export?.preset as keyof typeof EXPORT_PRESETS];
  if (preset && (project.scenes.at(-1)?.end ?? 0) > preset.maxSeconds)
    warnings.push('Project exceeds selected export preset duration');
  return warnings;
}
export function autoAssign(project: Project): Project {
  const copy = structuredClone(project);
  for (const asset of copy.assets) {
    const match = /^(scene|vo|sfx)[_-]0*(\d+)(?:[_\-.]|$)/i.exec(
      asset.name ?? asset.path.split(/[\\/]/).at(-1) ?? '',
    );
    if (!match) continue;
    const scene = copy.scenes[Number(match[2]) - 1];
    if (!scene) continue;
    if (match[1]?.toLowerCase() === 'scene' && asset.type !== 'audio')
      scene.visual = {
        assetId: asset.id,
        fit: copy.settings.defaultFit,
        inPoint: 0,
        crop: 'cover',
      };
    if (match[1]?.toLowerCase() === 'vo' && asset.type === 'audio')
      scene.voiceover = { assetId: asset.id, offset: 0.1 };
    if (
      match[1]?.toLowerCase() === 'sfx' &&
      asset.type === 'audio' &&
      !scene.sfx?.some((s) => s.assetId === asset.id)
    )
      (scene.sfx ??= []).push({ assetId: asset.id, offset: 0, gainDb: 0 });
  }
  return copy;
}
export function rippleEnd(scenes: Scene[], index: number, end: number): Scene[] {
  const copy = structuredClone(scenes);
  const scene = copy[index];
  if (!scene) return copy;
  const delta = end - scene.end;
  scene.end = end;
  for (let i = index + 1; i < copy.length; i++) {
    copy[i]!.start += delta;
    copy[i]!.end += delta;
  }
  return copy;
}
export function captionsSrt(project: Project): string {
  const stamp = (seconds: number) => {
    const ms = Math.max(0, Math.round(seconds * 1000));
    return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  };
  return project.scenes
    .filter((s) => s.caption?.text)
    .map(
      (s, i) =>
        `${i + 1}\n${stamp(s.start + s.caption!.offset)} --> ${stamp(Math.min(s.end, s.start + (s.caption!.end ?? s.end - s.start)))}\n${s.caption!.text}\n`,
    )
    .join('\n');
}
export function creditsText(project: Project): string {
  return project.assets
    .filter((a) => a.type === 'audio')
    .map(
      (a) =>
        `${a.name ?? a.id}\nSource: ${a.source ?? 'Not supplied'}\nLicense: ${a.license ?? 'Not supplied'}\nURL: ${a.licenseUrl ?? ''}\nCommercial use: ${a.commercialUse === undefined ? 'Unspecified' : a.commercialUse ? 'Yes' : 'No'}\n`,
    )
    .join('\n');
}
export function projectTemplate(project: Project): Project {
  const copy = structuredClone(project);
  copy.assets = [];
  if (copy.music) copy.music.assetId = '';
  for (const scene of copy.scenes) {
    if (scene.visual) scene.visual.assetId = '';
    if (scene.voiceover) scene.voiceover.assetId = '';
    for (const sfx of scene.sfx ?? []) sfx.assetId = '';
    for (const side of ['left', 'right'] as const)
      if (scene.template?.[side]?.assetId) scene.template[side]!.assetId = '';
  }
  return copy;
}
export function importPlan(text: string): { project: Project; notes: string[] } {
  const parsed = parseTimelineTable(text);
  const project = ProjectSchema.parse({
    name: 'Imported plan',
    settings: {},
    scenes: parsed.scenes,
  });
  let current: Scene | undefined;
  for (const line of text.split(/\r?\n/)) {
    const heading = /^\s*#{1,6}\s*(?:scene\s*)?(\d+)\b/i.exec(line);
    if (heading) current = project.scenes.find((s) => String(s.id) === String(Number(heading[1])));
    const field = /^\s*(?:[-*]\s*)?(?:\*\*)?(VOICEOVER|VO|CAPTION|SFX)(?:\*\*)?\s*:\s*(.*)/i.exec(
      line,
    );
    if (!current || !field) continue;
    const content = field[2]!
      .replace(/^\*\*\s*/, '')
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (/^(voiceover|vo)$/i.test(field[1]!)) current.script = content;
    else if (/caption/i.test(field[1]!))
      current.caption = { text: content, offset: 0.1, style: 'bigBold' };
    else current.sfxNotes = content;
  }
  return { project, notes: parsed.errors.map((e) => `Line ${e.line}: ${e.message}`) };
}
