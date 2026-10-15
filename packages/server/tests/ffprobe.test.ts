import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { probeFile } from '../src/services/ffprobe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.resolve(__dirname, '../../../samples');

describe('FFprobe Service', () => {
  it('probes clip01.mp4 and returns accurate metadata', async () => {
    const probe = await probeFile(path.join(SAMPLES_DIR, 'clip01.mp4'));

    expect(probe.duration).toBeCloseTo(3.0, 0);
    expect(probe.width).toBeGreaterThan(0);
    expect(probe.height).toBeGreaterThan(0);
    expect(probe.fps).toBeGreaterThan(0);
    expect(probe.codec).toMatch(/h264|hevc|vp9|av1/i);
    expect(probe.rotation).toBe(0);
  });

  it('probes clip02.mp4 and returns accurate metadata', async () => {
    const probe = await probeFile(path.join(SAMPLES_DIR, 'clip02.mp4'));

    expect(probe.duration).toBeCloseTo(4.0, 0);
    expect(probe.fps).toBeGreaterThan(0);
  });

  it('probes clip03.mp4 and returns accurate metadata', async () => {
    const probe = await probeFile(path.join(SAMPLES_DIR, 'clip03.mp4'));

    expect(probe.duration).toBeCloseTo(5.0, 0);
  });

  it('probes voiceover01.mp3 and returns audio metadata', async () => {
    const probe = await probeFile(path.join(SAMPLES_DIR, 'voiceover01.mp3'));

    // Audio-only — width/height should be 0
    expect(probe.width).toBe(0);
    expect(probe.height).toBe(0);
    expect(probe.duration).toBeGreaterThan(0);
  });
});
