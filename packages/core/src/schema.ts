import { z } from 'zod';

export const AssetTypeSchema = z.enum(['video', 'audio', 'image']);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetSchema = z.object({
  id: z.string(),
  type: AssetTypeSchema,
  path: z.string(),
  duration: z.number().nonnegative().optional(),
  hasAudio: z.boolean().optional(),
  license: z.string().optional(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const FitPolicySchema = z.enum(['trim', 'speed', 'loop', 'freeze-last']);
export type FitPolicy = z.infer<typeof FitPolicySchema>;

export const CropModeSchema = z.enum(['cover', 'contain']);
export type CropMode = z.infer<typeof CropModeSchema>;

export const MotionSchema = z.object({
  zoomFrom: z.number(),
  zoomTo: z.number(),
});
export type Motion = z.infer<typeof MotionSchema>;

export const VisualSchema = z.object({
  assetId: z.string(),
  fit: FitPolicySchema.optional().default('trim'),
  inPoint: z.number().nonnegative().optional().default(0),
  crop: CropModeSchema.optional().default('cover'),
  motion: MotionSchema.optional(),
});
export type Visual = z.infer<typeof VisualSchema>;

export const CaptionSchema = z.object({
  text: z.string(),
  offset: z.number().optional().default(0),
  style: z.string().optional().default('bigBold'),
});
export type Caption = z.infer<typeof CaptionSchema>;

export const VoiceoverSchema = z.object({
  assetId: z.string(),
  offset: z.number().optional().default(0),
});
export type Voiceover = z.infer<typeof VoiceoverSchema>;

export const SfxSchema = z.object({
  assetId: z.string(),
  offset: z.number().optional().default(0),
  gainDb: z.number().optional().default(0),
});
export type Sfx = z.infer<typeof SfxSchema>;

export const TransitionInSchema = z.object({
  type: z.string(),
  duration: z.number().positive().optional(),
});
export type TransitionIn = z.infer<typeof TransitionInSchema>;

export const TemplateSchema = z.object({
  type: z.string(),
  left: z.object({ fromScene: z.union([z.number(), z.string()]) }).optional(),
  right: z.object({ fromScene: z.union([z.number(), z.string()]) }).optional(),
  zoom: z.array(z.number()).optional(),
});
export type Template = z.infer<typeof TemplateSchema>;

export const SceneSchema = z.object({
  id: z.union([z.number(), z.string()]),
  label: z.string(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  visual: VisualSchema.optional(),
  caption: CaptionSchema.optional(),
  voiceover: VoiceoverSchema.optional(),
  sfx: z.array(SfxSchema).optional(),
  transitionIn: TransitionInSchema.optional(),
  template: TemplateSchema.optional(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const SettingsSchema = z.object({
  width: z.number().positive().default(1080),
  height: z.number().positive().default(1920),
  fps: z.number().positive().default(30),
  defaultFit: FitPolicySchema.default('trim'),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const MusicOverrideSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  gainDb: z.number(),
});
export type MusicOverride = z.infer<typeof MusicOverrideSchema>;

export const MusicSchema = z.object({
  assetId: z.string(),
  baseDb: z.number().default(-18),
  duckDb: z.number().default(-6),
  attack: z.number().default(0.15),
  release: z.number().default(0.35),
  fadeOut: z.number().default(1.5),
  overrides: z.array(MusicOverrideSchema).optional(),
});
export type Music = z.infer<typeof MusicSchema>;

export const TransitionSchema = z.object({
  between: z.tuple([z.union([z.number(), z.string()]), z.union([z.number(), z.string()])]),
  type: z.string(),
  duration: z.number().positive().optional(),
});
export type Transition = z.infer<typeof TransitionSchema>;

export const ExportSettingsSchema = z.object({
  preset: z.string().optional().default('shorts'),
  loudnessLufs: z.number().optional().default(-14),
});
export type ExportSettings = z.infer<typeof ExportSettingsSchema>;

export const ProjectSchema = z.object({
  schemaVersion: z.number().default(1),
  name: z.string(),
  settings: SettingsSchema,
  assets: z.array(AssetSchema).default([]),
  scenes: z.array(SceneSchema).default([]),
  music: MusicSchema.optional(),
  transitions: z.array(TransitionSchema).optional(),
  export: ExportSettingsSchema.optional(),
});
export type Project = z.infer<typeof ProjectSchema>;
