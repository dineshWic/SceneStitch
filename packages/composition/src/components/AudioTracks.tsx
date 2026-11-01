import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';
import {
  audioClips,
  dbToGain,
  fadeGain,
  musicDbAt,
  toFrame,
  type Project,
} from '@scenestitch/core';
const src = (path: string) => (/^(https?:|data:|file:)/.test(path) ? path : staticFile(path));
export const AudioTracks: React.FC<{ project: Project }> = ({ project }) => {
  const fps = project.settings.fps;
  const duration = project.scenes.at(-1)?.end ?? 0;
  const music = project.music;
  const asset = project.assets.find((a) => a.id === music?.assetId);
  const musicFrames = Math.max(
    1,
    toFrame((asset?.duration ?? duration) - (music?.inPoint ?? 0), fps),
  );
  const overlap = Math.min(Math.max(1, Math.round(fps * 0.05)), Math.floor(musicFrames / 4));
  const stride = Math.max(1, musicFrames - overlap);
  const repeats = Math.ceil(toFrame(duration, fps) / stride);
  return (
    <>
      {audioClips(project).map((clip, i) => (
        <Sequence
          key={i}
          from={toFrame(clip.start, fps)}
          durationInFrames={Math.max(1, toFrame(clip.duration, fps))}
        >
          <Audio
            src={src(project.assets.find((a) => a.id === clip.assetId)!.path)}
            startFrom={toFrame(clip.trimStart, fps)}
            playbackRate={clip.playbackRate}
            volume={(frame) =>
              dbToGain(clip.gainDb) *
              fadeGain(frame / fps, clip.duration, clip.fadeIn, clip.fadeOut)
            }
          />
        </Sequence>
      ))}
      {music && asset && asset.duration && asset.duration > (music.inPoint ?? 0)
        ? Array.from({ length: repeats }, (_, i) => (
            <Sequence
              key={`music-${i}`}
              from={i * stride}
              durationInFrames={Math.min(musicFrames, toFrame(duration, fps) - i * stride)}
            >
              <Audio
                src={src(asset.path)}
                startFrom={toFrame(music.inPoint ?? 0, fps)}
                endAt={toFrame(asset.duration ?? 0, fps)}
                volume={(frame) =>
                  dbToGain(musicDbAt(project, (i * stride + frame) / fps)) *
                  fadeGain((i * stride + frame) / fps, duration, music.fadeIn, music.fadeOut) *
                  fadeGain(
                    frame / fps,
                    musicFrames / fps,
                    i > 0 ? overlap / fps : 0,
                    i < repeats - 1 ? overlap / fps : 0,
                  )
                }
              />
            </Sequence>
          ))
        : null}
    </>
  );
};
