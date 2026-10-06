import { describe, it, expect } from 'vitest';
import { parseTimelineTable, buildFrameTimeline, validateTimeline } from '../src/index.js';

describe('Table Parser', () => {
  const CAPYBARA_MARKDOWN_TABLE = `
| Time | Scene | Story beat |
|---|---|---|
| 0.0–2.2 s | 1 | Impossible-looking capybara salon hook |
| 2.2–4.5 s | 2 | Muddy condition revealed |
| 4.5–7.3 s | 3 | Warm rinse begins |
| 7.3–10.1 s | 4 | Satisfying foam bath |
| 10.1–13.0 s | 5 | Gentle brush / mud removal |
| 13.0–16.1 s | 6 | Rinse reveal |
| 16.1–19.3 s | 7 | Blow-dry transformation |
| 19.3–22.3 s | 8 | Coat finishing + spa styling |
| 22.3–27.2 s | 9 | Full glamorous reveal |
| 27.2–30.0 s | 10 | Before/after + comment CTA |
`;

  it('parses the reference Capybara Markdown table into 10 scenes, 900 frames, 0 validation errors', () => {
    const { scenes, errors } = parseTimelineTable(CAPYBARA_MARKDOWN_TABLE);
    expect(errors.length).toBe(0);
    expect(scenes.length).toBe(10);

    // Verify first scene
    expect(scenes[0]?.id).toBe(1);
    expect(scenes[0]?.start).toBe(0.0);
    expect(scenes[0]?.end).toBe(2.2);
    expect(scenes[0]?.label).toBe('Impossible-looking capybara salon hook');

    // Verify last scene
    expect(scenes[9]?.id).toBe(10);
    expect(scenes[9]?.start).toBe(27.2);
    expect(scenes[9]?.end).toBe(30.0);

    // Verify validation
    const valErrors = validateTimeline(scenes);
    expect(valErrors.length).toBe(0);

    // Verify frame timeline calculation
    const { totalFrames, computedScenes } = buildFrameTimeline(scenes, 30);
    expect(totalFrames).toBe(900);
    expect(computedScenes.length).toBe(10);
    expect(computedScenes[9]?.endFrame).toBe(900);
  });

  it('parses CSV table input', () => {
    const csv = `
Time,Scene,Story
0.0-2.5s,1,Hook
2.5-6.0s,2,Main Action
`;
    const { scenes, errors } = parseTimelineTable(csv);
    expect(errors.length).toBe(0);
    expect(scenes.length).toBe(2);
    expect(scenes[0]?.start).toBe(0.0);
    expect(scenes[0]?.end).toBe(2.5);
  });

  it('parses TSV table input', () => {
    const tsv = "Time\tScene\tStory\n0.0–3.0s\t1\tIntro\n3.0–8.0s\t2\tBody";
    const { scenes, errors } = parseTimelineTable(tsv);
    expect(errors.length).toBe(0);
    expect(scenes.length).toBe(2);
    expect(scenes[1]?.start).toBe(3.0);
    expect(scenes[1]?.end).toBe(8.0);
  });

  it('handles minute:second time formats like 01:02.5-01:05.0', () => {
    const table = `| 01:00.0 - 01:02.5s | 1 | Clip 1 |`;
    const { scenes, errors } = parseTimelineTable(table);
    expect(errors.length).toBe(0);
    expect(scenes[0]?.start).toBe(60.0);
    expect(scenes[0]?.end).toBe(62.5);
  });

  it('reports errors for malformed or unparseable time ranges', () => {
    const brokenTable = `
| Time | Scene | Story beat |
|---|---|---|
| invalid-range | 1 | Broken scene |
`;
    const { scenes, errors } = parseTimelineTable(brokenTable);
    expect(scenes.length).toBe(0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('Could not parse time range');
  });
});
