import type { Scene } from './schema.js';

export interface ValidationError {
  sceneId: number | string;
  code: 'ZERO_DURATION' | 'INVALID_BOUNDARIES' | 'NON_INCREASING' | 'GAP_DETECTED' | 'OVERLAP_DETECTED';
  message: string;
}

export function validateTimeline(scenes: Scene[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const EPSILON = 0.0001; // tolerance for floating point comparisons

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!scene) continue;

    // Check 1: Zero or negative duration
    if (scene.start >= scene.end) {
      errors.push({
        sceneId: scene.id,
        code: scene.start === scene.end ? 'ZERO_DURATION' : 'INVALID_BOUNDARIES',
        message: `Scene ${scene.id} has duration <= 0 (start=${scene.start}s, end=${scene.end}s)`,
      });
    }

    if (i > 0) {
      const prev = scenes[i - 1];
      if (!prev) continue;

      // Check 2: Non-increasing start times
      if (scene.start < prev.start) {
        errors.push({
          sceneId: scene.id,
          code: 'NON_INCREASING',
          message: `Scene ${scene.id} start time (${scene.start}s) is earlier than previous scene ${prev.id} start time (${prev.start}s)`,
        });
      }

      // Check 3: Gap detected (current start > prev end)
      const diff = scene.start - prev.end;
      if (diff > EPSILON) {
        errors.push({
          sceneId: scene.id,
          code: 'GAP_DETECTED',
          message: `Gap of ${diff.toFixed(3)}s detected between scene ${prev.id} (ends ${prev.end}s) and scene ${scene.id} (starts ${scene.start}s)`,
        });
      }

      // Check 4: Overlap detected (current start < prev end)
      if (diff < -EPSILON) {
        errors.push({
          sceneId: scene.id,
          code: 'OVERLAP_DETECTED',
          message: `Overlap of ${Math.abs(diff).toFixed(3)}s detected between scene ${prev.id} (ends ${prev.end}s) and scene ${scene.id} (starts ${scene.start}s)`,
        });
      }
    }
  }

  return errors;
}
