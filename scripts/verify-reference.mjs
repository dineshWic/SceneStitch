import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input =
  process.argv[2] ?? path.join(root, 'output/reference-benchmark/final-verification-1.mp4');
const directory = path.dirname(input);
const { stdout } = await exec('ffprobe', [
  '-v',
  'error',
  '-count_frames',
  '-show_streams',
  '-show_format',
  '-of',
  'json',
  input,
]);
const probe = JSON.parse(stdout);
const video = probe.streams.find((s) => s.codec_type === 'video');
const audio = probe.streams.find((s) => s.codec_type === 'audio');
if (
  Number(video.nb_read_frames) !== 900 ||
  video.width !== 1080 ||
  video.height !== 1920 ||
  video.codec_name !== 'h264' ||
  audio?.codec_name !== 'aac' ||
  Math.abs(Number(probe.format.duration) - 30) > 1 / 30
)
  throw new Error('Reference output stream/frame verification failed');
const frames = [0, 3, 65, 66, 668, 669, 675, 816, 899];
const select = `select='${frames.map((n) => `eq(n,${n})`).join('+')}'`;
const raw = await exec(
  'ffmpeg',
  [
    '-v',
    'error',
    '-i',
    input,
    '-vf',
    `${select},scale=108:192`,
    '-fps_mode',
    'vfr',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
    'pipe:1',
  ],
  { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 },
);
const pixels = 108 * 192 * 3;
if (raw.stdout.length !== frames.length * pixels)
  throw new Error('Unable to extract boundary frames');
const frame = (number) =>
  raw.stdout.subarray(frames.indexOf(number) * pixels, (frames.indexOf(number) + 1) * pixels);
const mean = (buffer) => buffer.reduce((sum, x) => sum + x, 0) / buffer.length;
const difference = (a, b) => a.reduce((sum, x, i) => sum + Math.abs(x - b[i]), 0) / a.length;
const flash = mean(frame(669));
const cut = difference(frame(65), frame(66));
if (flash < 250 || mean(frame(668)) >= 245 || cut < 15)
  throw new Error('Flash/cut boundary pixel verification failed');
const decoded = await exec(
  'ffmpeg',
  [
    '-v',
    'error',
    '-i',
    input,
    '-vn',
    '-af',
    'bandpass=frequency=220:width_type=h:width=10',
    '-ac',
    '1',
    '-ar',
    '48000',
    '-f',
    'f32le',
    'pipe:1',
  ],
  { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 },
);
const rms = (start, end) => {
  let sum = 0;
  const first = Math.round(start * 48000);
  const last = Math.round(end * 48000);
  for (let i = first; i < last; i++) {
    const sample = decoded.stdout.readFloatLE(i * 4);
    sum += sample * sample;
  }
  return Math.sqrt(sum / (last - first));
};
const voiceRatio = rms(0.3, 0.4) / Math.max(1e-9, rms(0.02, 0.06));
const jCutRatio = rms(4.4, 4.45) / Math.max(1e-9, rms(4.1, 4.2));
if (voiceRatio < 2 || jCutRatio < 1.5)
  throw new Error('Expected narration/J-cut audio was not detected in its planned window');
await exec('ffmpeg', [
  '-v',
  'error',
  '-y',
  '-i',
  input,
  '-vf',
  `${select},scale=360:640,tile=3x3`,
  '-frames:v',
  '1',
  path.join(directory, 'reference-boundaries.png'),
]);
const result = {
  frames: 900,
  duration: Number(probe.format.duration),
  width: video.width,
  height: video.height,
  videoCodec: video.codec_name,
  audioCodec: audio.codec_name,
  flashFrame: 669,
  flashMean: flash,
  firstCutFrame: 66,
  cutPixelDifference: cut,
  narrationBandRatio: voiceRatio,
  jCutBandRatio: jCutRatio,
  inspectedFrames: frames,
};
await fs.writeFile(
  path.join(directory, 'reference-verification.json'),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
