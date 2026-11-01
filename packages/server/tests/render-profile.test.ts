import { describe, expect, it } from 'vitest';
import { ProjectSchema } from '@scenestitch/core';
import { renderProfile, withAbort } from '../src/services/render-profile.js';
describe('Render configuration and cancellation', () => {
  const settings = ProjectSchema.parse({ name: 'Test', settings: {} }).settings;
  it('keeps draft H.264 dimensions even and validates concurrency', () => {
    expect(renderProfile(settings, true, '1')).toMatchObject({
      scale: 0.5,
      concurrency: 1,
      x264Preset: 'ultrafast',
    });
    expect(renderProfile({ ...settings, width: 1082 }, true, '1').scale).toBe(1);
    expect(renderProfile(settings, false, '1')).toMatchObject({
      scale: 1,
      crf: 18,
      x264Preset: 'fast',
    });
    for (const value of ['0', '-1', '2.5', 'invalid', '999999'])
      expect(() => renderProfile(settings, false, value)).toThrow('CONCURRENCY');
  });
  it('lets a cancelled export stop waiting for a shared bundle without disrupting other exports', async () => {
    let resolve!: (value: string) => void;
    const bundle = new Promise<string>((r) => {
      resolve = r;
    });
    const controller = new AbortController();
    const waiting = withAbort(bundle, controller.signal);
    controller.abort();
    await expect(waiting).rejects.toThrow('cancelled');
    resolve('shared bundle');
    await expect(withAbort(bundle)).resolves.toBe('shared bundle');
    await expect(withAbort(Promise.resolve('ready'), controller.signal)).rejects.toThrow();
  });
});
