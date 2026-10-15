import { describe, it, expect } from 'vitest';
import { validateTimeline, type Scene } from '../src/index.js';

describe('Timeline Validator', () => {
  it('returns no errors for a valid contiguous timeline', () => {
    const scenes: Scene[] = [
      { id: 1, label: 'Scene 1', start: 0.0, end: 2.2 },
      { id: 2, label: 'Scene 2', start: 2.2, end: 4.5 },
      { id: 3, label: 'Scene 3', start: 4.5, end: 7.3 },
    ];
    const errors = validateTimeline(scenes);
    expect(errors.length).toBe(0);
  });

  it('detects zero duration scenes', () => {
    const scenes: Scene[] = [{ id: 1, label: 'Scene 1', start: 2.0, end: 2.0 }];
    const errors = validateTimeline(scenes);
    expect(errors.length).toBe(1);
    expect(errors[0]?.code).toBe('ZERO_DURATION');
    expect(errors[0]?.sceneId).toBe(1);
  });

  it('detects invalid negative duration boundaries', () => {
    const scenes: Scene[] = [{ id: 1, label: 'Scene 1', start: 5.0, end: 2.0 }];
    const errors = validateTimeline(scenes);
    expect(errors.length).toBe(1);
    expect(errors[0]?.code).toBe('INVALID_BOUNDARIES');
  });

  it('detects gaps between scenes', () => {
    const scenes: Scene[] = [
      { id: 1, label: 'Scene 1', start: 0.0, end: 2.0 },
      { id: 2, label: 'Scene 2', start: 2.5, end: 5.0 }, // 0.5s gap
    ];
    const errors = validateTimeline(scenes);
    expect(errors.length).toBe(1);
    expect(errors[0]?.code).toBe('GAP_DETECTED');
    expect(errors[0]?.sceneId).toBe(2);
  });

  it('detects overlaps between scenes', () => {
    const scenes: Scene[] = [
      { id: 1, label: 'Scene 1', start: 0.0, end: 3.0 },
      { id: 2, label: 'Scene 2', start: 2.5, end: 5.0 }, // 0.5s overlap
    ];
    const errors = validateTimeline(scenes);
    expect(errors.length).toBe(1);
    expect(errors[0]?.code).toBe('OVERLAP_DETECTED');
    expect(errors[0]?.sceneId).toBe(2);
  });

  it('detects non-increasing scene start times', () => {
    const scenes: Scene[] = [
      { id: 1, label: 'Scene 1', start: 4.0, end: 6.0 },
      { id: 2, label: 'Scene 2', start: 2.0, end: 5.0 },
    ];
    const errors = validateTimeline(scenes);
    const nonInc = errors.find((e) => e.code === 'NON_INCREASING');
    expect(nonInc).toBeDefined();
  });
});
