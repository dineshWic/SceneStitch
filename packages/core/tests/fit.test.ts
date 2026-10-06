import { describe, it, expect } from 'vitest';
import { calculateFit } from '../src/index.js';

describe('Fit Calculator', () => {
  describe('trim policy', () => {
    it('handles source longer than scene duration', () => {
      const res = calculateFit(3.0, 5.0, 'trim');
      expect(res.inPoint).toBe(0);
      expect(res.playbackRate).toBe(1.0);
      expect(res.loops).toBe(1);
      expect(res.freezeFrames).toBe(0);
      expect(res.warnings.length).toBe(0);
    });

    it('handles source equal to scene duration', () => {
      const res = calculateFit(3.0, 3.0, 'trim');
      expect(res.playbackRate).toBe(1.0);
      expect(res.loops).toBe(1);
      expect(res.freezeFrames).toBe(0);
      expect(res.warnings.length).toBe(0);
    });

    it('handles source shorter than scene duration (generates warning)', () => {
      const res = calculateFit(5.0, 3.0, 'trim');
      expect(res.playbackRate).toBe(1.0);
      expect(res.warnings.length).toBe(1);
      expect(res.warnings[0]).toContain('shorter than scene duration');
    });

    it('respects inPoint option', () => {
      const res = calculateFit(3.0, 5.0, 'trim', { inPoint: 1.0 });
      expect(res.inPoint).toBe(1.0);
      expect(res.warnings.length).toBe(0);
    });
  });

  describe('speed policy', () => {
    it('speeds up video when source is longer than scene', () => {
      const res = calculateFit(2.0, 4.0, 'speed');
      expect(res.playbackRate).toBe(2.0); // 4 / 2 = 2x speed
      expect(res.loops).toBe(1);
      expect(res.freezeFrames).toBe(0);
      expect(res.warnings.length).toBe(0);
    });

    it('plays at 1.0x when source equals scene duration', () => {
      const res = calculateFit(3.0, 3.0, 'speed');
      expect(res.playbackRate).toBe(1.0);
      expect(res.warnings.length).toBe(0);
    });

    it('slows down video when source is shorter than scene', () => {
      const res = calculateFit(4.0, 2.0, 'speed');
      expect(res.playbackRate).toBe(0.5); // 2 / 4 = 0.5x speed
      expect(res.warnings.length).toBe(0);
    });

    it('warns on extreme playback rate multipliers', () => {
      const res = calculateFit(1.0, 5.0, 'speed');
      expect(res.playbackRate).toBe(5.0);
      expect(res.warnings.length).toBe(1);
      expect(res.warnings[0]).toContain('Extreme playback rate multiplier');
    });
  });

  describe('loop policy', () => {
    it('loops 1 time when source is longer than or equal to scene duration', () => {
      const res1 = calculateFit(3.0, 5.0, 'loop');
      expect(res1.loops).toBe(1);

      const res2 = calculateFit(3.0, 3.0, 'loop');
      expect(res2.loops).toBe(1);
    });

    it('calculates loop count when source is shorter than scene duration', () => {
      const res = calculateFit(5.0, 2.0, 'loop');
      expect(res.loops).toBe(3); // 2.0s * 3 = 6.0s >= 5.0s
      expect(res.playbackRate).toBe(1.0);
      expect(res.freezeFrames).toBe(0);
    });
  });

  describe('freeze-last policy', () => {
    it('does not freeze when source is longer than or equal to scene duration', () => {
      const res1 = calculateFit(3.0, 5.0, 'freeze-last');
      expect(res1.freezeFrames).toBe(0);

      const res2 = calculateFit(3.0, 3.0, 'freeze-last');
      expect(res2.freezeFrames).toBe(0);
    });

    it('calculates freeze frames when source is shorter than scene duration', () => {
      // scene duration = 4.0s, source = 2.5s -> freeze time = 1.5s -> at 30fps = 45 frames
      const res = calculateFit(4.0, 2.5, 'freeze-last', { fps: 30 });
      expect(res.playbackRate).toBe(1.0);
      expect(res.loops).toBe(1);
      expect(res.freezeFrames).toBe(45);
    });
  });
});
