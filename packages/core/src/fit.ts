import type { FitPolicy } from './schema.js';
import { toFrame } from './timing.js';

export interface FitOptions {
  inPoint?: number;
  fps?: number;
}

export interface FitResult {
  inPoint: number;
  playbackRate: number;
  loops: number;
  freezeFrames: number;
  warnings: string[];
}

export function calculateFit(
  sceneDuration: number,
  sourceDuration: number,
  policy: FitPolicy = 'trim',
  options?: FitOptions,
): FitResult {
  const inPoint = options?.inPoint ?? 0;
  const fps = options?.fps ?? 30;
  const warnings: string[] = [];

  const availableDuration = Math.max(0, sourceDuration - inPoint);

  let playbackRate = 1.0;
  let loops = 1;
  let freezeFrames = 0;

  switch (policy) {
    case 'trim': {
      playbackRate = 1.0;
      loops = 1;
      freezeFrames = 0;

      if (availableDuration < sceneDuration) {
        warnings.push(
          `Source duration (${availableDuration.toFixed(2)}s available) is shorter than scene duration (${sceneDuration.toFixed(2)}s) for trim fit; visual may end early or freeze.`,
        );
      }
      break;
    }

    case 'speed': {
      if (availableDuration <= 0) {
        playbackRate = 1.0;
        warnings.push('In-point is beyond source duration; cannot compute speed fit.');
      } else {
        playbackRate = availableDuration / sceneDuration;
        if (playbackRate > 3.0 || playbackRate < 0.25) {
          warnings.push(`Extreme playback rate multiplier (${playbackRate.toFixed(2)}x).`);
        }
      }
      loops = 1;
      freezeFrames = 0;
      break;
    }

    case 'loop': {
      playbackRate = 1.0;
      freezeFrames = 0;

      if (availableDuration <= 0) {
        loops = 1;
        warnings.push('In-point is beyond source duration; cannot loop.');
      } else if (availableDuration >= sceneDuration) {
        loops = 1;
      } else {
        loops = Math.ceil(sceneDuration / availableDuration);
      }
      break;
    }

    case 'freeze-last': {
      playbackRate = 1.0;
      loops = 1;

      if (availableDuration >= sceneDuration) {
        freezeFrames = 0;
      } else {
        const freezeTime = sceneDuration - availableDuration;
        freezeFrames = toFrame(freezeTime, fps);
      }
      break;
    }

    default: {
      const _exhaustiveCheck: never = policy;
      throw new Error(`Unsupported fit policy: ${_exhaustiveCheck}`);
    }
  }

  return {
    inPoint,
    playbackRate,
    loops,
    freezeFrames,
    warnings,
  };
}
