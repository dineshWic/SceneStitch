import type { Scene } from './schema.js';

export interface ParseError {
  line: number;
  raw: string;
  message: string;
}

export interface ParseResult {
  scenes: Scene[];
  errors: ParseError[];
}

export function parseTime(timeStr: string): number {
  const clean = timeStr
    .trim()
    .replace(/s(ec(onds?)?)?$/i, '')
    .trim();

  if (!clean) {
    throw new Error(`Empty time value: "${timeStr}"`);
  }

  if (clean.includes(':')) {
    const parts = clean.split(':');
    if (parts.length === 2 && parts[0] !== undefined && parts[1] !== undefined) {
      const minutes = parseFloat(parts[0]);
      const seconds = parseFloat(parts[1]);
      if (isNaN(minutes) || isNaN(seconds)) {
        throw new Error(`Invalid minute:second format: "${timeStr}"`);
      }
      return minutes * 60 + seconds;
    }
  }

  const val = parseFloat(clean);
  if (isNaN(val)) {
    throw new Error(`Invalid time number: "${timeStr}"`);
  }
  return val;
}

export function parseTimeRange(rangeStr: string): { start: number; end: number } {
  const normalized = rangeStr
    .trim()
    .replace(/[\u2013\u2014~]/g, '-') // replace en-dash, em-dash, tilde with hyphen
    .replace(/\s+to\s+/gi, '-')
    .replace(/\s*-\s*/g, '-');

  const parts = normalized.split('-');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Expected time range like "0.0–2.2s", got "${rangeStr}"`);
  }

  const start = parseTime(parts[0]);
  const end = parseTime(parts[1]);

  if (start > end) {
    throw new Error(
      `Start time (${start}s) is greater than end time (${end}s) in range "${rangeStr}"`,
    );
  }

  return { start, end };
}

export function parseTimelineTable(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const scenes: Scene[] = [];
  const errors: ParseError[] = [];

  const rawLines = lines.map((line) => line.trim()).filter((line) => line.length > 0);

  const isMarkdown = rawLines.some((l) => l.includes('|'));

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]?.trim() ?? '';
    if (!rawLine) continue;

    const lineNum = i + 1;

    // Skip separator lines like |---|---| or |:---|
    if (/^\|?\s*:?-+:?\s*(\||\+)/.test(rawLine)) {
      continue;
    }

    let cells: string[] = [];

    if (isMarkdown) {
      if (!rawLine.includes('|')) continue;
      cells = rawLine.split('|').map((c) => c.trim());
      // Remove empty cells from leading/trailing pipe
      if (cells[0] === '') cells.shift();
      if (cells[cells.length - 1] === '') cells.pop();
    } else {
      // CSV or TSV
      const sep = rawLine.includes('\t') ? '\t' : ',';
      cells = rawLine.split(sep).map((c) => c.trim());
    }

    if (cells.length < 2) continue;

    // Skip header row (e.g. Time, Scene, Story beat)
    const firstCell = cells[0]?.toLowerCase() ?? '';
    if (firstCell.includes('time') || firstCell.includes('start') || firstCell === 's') {
      continue;
    }

    let timeCell = '';
    let idCell = '';
    let labelCell = '';

    // Determine cell roles
    // Typical format: [Time Range, Scene ID, Story Beat/Label] or [Scene ID, Time Range, Label]
    const tryParseRange0 = (c: string) => {
      try {
        return parseTimeRange(c);
      } catch {
        return null;
      }
    };

    const range0 = cells[0] ? tryParseRange0(cells[0]) : null;
    const range1 = cells[1] ? tryParseRange0(cells[1]) : null;

    if (range0) {
      timeCell = cells[0]!;
      idCell = cells[1] ?? `${scenes.length + 1}`;
      labelCell = cells.slice(2).join(' - ') || `Scene ${idCell}`;
    } else if (range1) {
      idCell = cells[0]!;
      timeCell = cells[1]!;
      labelCell = cells.slice(2).join(' - ') || `Scene ${idCell}`;
    } else {
      // Failed to identify time range cell
      errors.push({
        line: lineNum,
        raw: rawLine,
        message: `Could not parse time range from line: "${rawLine}"`,
      });
      continue;
    }

    try {
      const { start, end } = parseTimeRange(timeCell);
      const parsedId = /^\d+$/.test(idCell) ? parseInt(idCell, 10) : idCell;

      scenes.push({
        id: parsedId,
        label: labelCell || `Scene ${parsedId}`,
        start,
        end,
      });
    } catch (err) {
      errors.push({
        line: lineNum,
        raw: rawLine,
        message: (err as Error).message,
      });
    }
  }

  return { scenes, errors };
}
