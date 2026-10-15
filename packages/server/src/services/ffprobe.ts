import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface ProbeData {
  duration: number;
  width: number;
  height: number;
  fps: number;
  rotation: number;
  hasAudio: boolean;
  codec: string;
  format: string;
  size: number;
}

interface FfprobeSideData {
  side_data_type?: string;
  rotation?: number;
}

interface FfprobeStream {
  codec_type: string;
  codec_name: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  duration?: string;
  tags?: Record<string, string>;
  side_data_list?: FfprobeSideData[];
}

interface FfprobeFormat {
  duration?: string;
  size?: string;
  format_name?: string;
  tags?: Record<string, string>;
}

interface FfprobeOutput {
  streams: FfprobeStream[];
  format: FfprobeFormat;
}

function parseFraction(fraction: string): number {
  const [num, den] = fraction.split('/').map(Number);
  if (!num || !den || den === 0) return 0;
  return num / den;
}

export async function probeFile(filePath: string): Promise<ProbeData> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    filePath,
  ]);

  const raw = JSON.parse(stdout) as FfprobeOutput;
  const videoStream = raw.streams.find((s) => s.codec_type === 'video');
  const audioStream = raw.streams.find((s) => s.codec_type === 'audio');

  const duration = parseFloat(
    videoStream?.duration ?? raw.format.duration ?? '0',
  );
  const width = videoStream?.width ?? 0;
  const height = videoStream?.height ?? 0;

  // Prefer r_frame_rate for constant framerate, fall back to avg_frame_rate
  const rawFps =
    videoStream?.r_frame_rate && videoStream.r_frame_rate !== '0/0'
      ? videoStream.r_frame_rate
      : videoStream?.avg_frame_rate ?? '0/1';
  const fps = parseFraction(rawFps);

  // Rotation from side-data, stream tags, or format tags
  const sideDataRotation = videoStream?.side_data_list?.find(
    (sd) => sd.rotation !== undefined,
  )?.rotation;
  const rotateTags =
    videoStream?.tags?.rotate ??
    videoStream?.tags?.ROTATE ??
    raw.format.tags?.rotate ??
    raw.format.tags?.ROTATE;

  const rawRotation = sideDataRotation !== undefined
    ? Math.abs(sideDataRotation)
    : rotateTags
      ? Math.abs(parseInt(rotateTags, 10))
      : 0;
  const rotation = isNaN(rawRotation) ? 0 : rawRotation;

  return {
    duration,
    width,
    height,
    fps: Math.round(fps * 100) / 100,
    rotation,
    hasAudio: Boolean(audioStream),
    codec: videoStream?.codec_name ?? 'unknown',
    format: raw.format.format_name ?? 'unknown',
    size: parseInt(raw.format.size ?? '0', 10),
  };
}
