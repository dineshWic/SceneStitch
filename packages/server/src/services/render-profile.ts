import type { Settings } from '@scenestitch/core';
import { availableParallelism } from 'node:os';
export function renderProfile(settings: Settings, draft: boolean, requestedConcurrency?: string) {
  const cores = availableParallelism();
  const concurrency =
    requestedConcurrency === undefined
      ? Math.max(1, Math.min(4, cores - 1))
      : Number(requestedConcurrency);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > cores)
    throw new Error(`SCENESTITCH_RENDER_CONCURRENCY must be an integer from 1 to ${cores}`);
  // Half of dimensions divisible only by two would produce odd-sized H.264 frames.
  const scale = draft && settings.width % 4 === 0 && settings.height % 4 === 0 ? 0.5 : 1;
  return {
    scale,
    concurrency,
    crf: draft ? 28 : 18,
    x264Preset: draft ? ('ultrafast' as const) : ('fast' as const),
  };
}
export async function withAbort<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  signal.throwIfAborted();
  let abort!: () => void;
  const interrupted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(new Error('Render cancelled'));
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([operation, interrupted]);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
