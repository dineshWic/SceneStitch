import React from 'react';
import { Freeze, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { calculateFit, type Asset, type Visual } from '@scenestitch/core';
import { KenBurnsImage } from './KenBurnsImage.js';
export interface SceneVisualProps {
  asset?: Asset;
  visual?: Visual;
  durationInFrames: number;
  fps?: number;
}
export const SceneVisual: React.FC<SceneVisualProps> = ({
  asset,
  visual,
  durationInFrames,
  fps = 30,
}) => {
  const frame = useCurrentFrame();
  if (!asset || asset.type === 'audio')
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#181825',
          color: 'white',
          display: 'grid',
          placeItems: 'center',
          font: '32px sans-serif',
        }}
      >
        No Asset Assigned
      </div>
    );
  const src = /^(https?:|file:|data:)/.test(asset.path) ? asset.path : staticFile(asset.path);
  const crop = visual?.crop ?? 'cover';
  if (asset.type === 'image')
    return (
      <KenBurnsImage
        src={src}
        crop={crop}
        zoomFrom={visual?.motion?.zoomFrom ?? 1}
        zoomTo={visual?.motion?.zoomTo ?? 1}
        durationInFrames={durationInFrames}
      />
    );
  const fit = calculateFit(
    durationInFrames / fps,
    asset.duration ?? durationInFrames / fps,
    visual?.fit,
    { fps, inPoint: visual?.inPoint },
  );
  const available = Math.max(
    1,
    Math.round(((asset.duration ?? durationInFrames / fps) - fit.inPoint) * fps),
  );
  const start = Math.round(fit.inPoint * fps);
  const scale =
    (visual?.motion?.zoomFrom ?? 1) +
    ((visual?.motion?.zoomTo ?? 1) - (visual?.motion?.zoomFrom ?? 1)) *
      Math.min(1, frame / Math.max(1, durationInFrames - 1));
  const video = (
    <div
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', transform: `scale(${scale})` }}
    >
      {crop === 'contain' ? (
        <OffthreadVideo
          muted
          src={src}
          startFrom={start}
          playbackRate={fit.playbackRate}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(24px) brightness(.5)',
            transform: 'scale(1.15)',
          }}
        />
      ) : null}
      <OffthreadVideo
        muted
        src={src}
        startFrom={start}
        playbackRate={fit.playbackRate}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: crop }}
      />
    </div>
  );
  if (visual?.fit === 'loop') return <Loop durationInFrames={available}>{video}</Loop>;
  if ((visual?.fit === 'freeze-last' || visual?.fit === 'trim') && available < durationInFrames)
    return (
      <>
        <Sequence durationInFrames={available}>{video}</Sequence>
        <Sequence from={available} durationInFrames={durationInFrames - available}>
          <Freeze frame={available - 1}>{video}</Freeze>
        </Sequence>
      </>
    );
  return video;
};
