import type { Scene } from './schema.js';

export function toFrame(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

export interface ComputedSceneFrame {
  sceneId: number | string;
  startSec: number;
  endSec: number;
  startFrame: number;
  endFrame: number;
  durationInFrames: number;
}

export interface FrameTimelineResult {
  computedScenes: ComputedSceneFrame[];
  totalFrames: number;
}

export function buildFrameTimeline(scenes: Scene[], fps: number = 30): FrameTimelineResult {
  const computedScenes: ComputedSceneFrame[] = [];

  for (const scene of scenes) {
    const startFrame = toFrame(scene.start, fps);
    const endFrame = toFrame(scene.end, fps);
    const durationInFrames = Math.max(0, endFrame - startFrame);

    computedScenes.push({
      sceneId: scene.id,
      startSec: scene.start,
      endSec: scene.end,
      startFrame,
      endFrame,
      durationInFrames,
    });
  }

  const lastScene = computedScenes[computedScenes.length - 1];
  const totalFrames = lastScene ? lastScene.endFrame : 0;

  return {
    computedScenes,
    totalFrames,
  };
}
