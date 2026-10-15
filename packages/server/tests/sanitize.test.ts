import { describe, it, expect } from 'vitest';
import { sanitizeFilename } from '../src/services/ffmpeg.js';

describe('sanitizeFilename', () => {
  it('preserves safe characters and lowercases the extension', () => {
    expect(sanitizeFilename('My_Video-01.MP4')).toBe('My_Video-01.mp4');
  });

  it('replaces spaces and special chars with underscores', () => {
    expect(sanitizeFilename('my video (2024).mp4')).toBe('my_video_2024.mp4');
  });

  it('collapses multiple underscores', () => {
    expect(sanitizeFilename('a   b.mp4')).toBe('a_b.mp4');
  });

  it('strips leading and trailing underscores from basename', () => {
    expect(sanitizeFilename('___clip___.mp4')).toBe('clip.mp4');
  });

  it('handles filename with no basename (only extension)', () => {
    const result = sanitizeFilename('.mp4');
    expect(result).toBe('file.mp4');
  });

  it('handles Chinese/emoji filenames gracefully', () => {
    const result = sanitizeFilename('视频🎥.mp4');
    expect(result).toMatch(/\.mp4$/);
    expect(result).not.toMatch(/[^a-zA-Z0-9._-]/);
  });
});
