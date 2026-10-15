import React from 'react';
import { OffthreadVideo, Sequence, staticFile } from 'remotion';
import { calculateFit, type Asset, type Visual } from '@scenestitch/core';
import { KenBurnsImage } from './KenBurnsImage.js';

export interface SceneVisualProps {
  asset?: Asset;
  visual?: Visual;
  durationInFrames: number;
  fps?: number;
}

function resolveAssetPath(path: string): string {
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('file://') ||
    path.startsWith('data:')
  ) {
    return path;
  }
  return staticFile(path);
}

export const SceneVisual: React.FC<SceneVisualProps> = ({
  asset,
  visual,
  durationInFrames,
  fps = 30,
}) => {
  if (!asset) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#181825',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#CDD6F4',
          fontFamily: 'sans-serif',
          fontSize: 32,
        }}
      >
        No Asset Assigned
      </div>
    );
  }

  const src = resolveAssetPath(asset.path);
  const sceneDurationSec = durationInFrames / fps;
  const sourceDurationSec = asset.duration ?? sceneDurationSec;

  const fitResult = calculateFit(sceneDurationSec, sourceDurationSec, visual?.fit ?? 'trim', {
    inPoint: visual?.inPoint ?? 0,
    fps,
  });

  const crop = visual?.crop ?? 'cover';
  const zoomFrom = visual?.motion?.zoomFrom ?? 1.0;
  const zoomTo = visual?.motion?.zoomTo ?? 1.0;

  if (asset.type === 'image') {
    return (
      <KenBurnsImage
        src={src}
        zoomFrom={zoomFrom}
        zoomTo={zoomTo}
        crop={crop}
        durationInFrames={durationInFrames}
      />
    );
  }

  // Video asset handling
  const inPointInFrames = Math.round(fitResult.inPoint * fps);
  const playbackRate = fitResult.playbackRate;

  const videoElement = (
    <OffthreadVideo
      src={src}
      startFrom={inPointInFrames}
      playbackRate={playbackRate}
      style={{
        width: '100%',
        height: '100%',
        objectFit: crop === 'contain' ? 'contain' : 'cover',
      }}
    />
  );

  if (crop === 'contain') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#000',
        }}
      >
        {/* Blurred backdrop for contain crop mode */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
          }}
        >
          <OffthreadVideo
            src={src}
            startFrom={inPointInFrames}
            playbackRate={playbackRate}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(24px) brightness(0.5)',
              transform: 'scale(1.15)',
            }}
          />
        </div>

        {/* Foreground video */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {videoElement}
        </div>
      </div>
    );
  }

  // Loop support if fit policy produces multiple loops
  if (fitResult.loops > 1) {
    const loopDurationSec = Math.max(0.1, sourceDurationSec - fitResult.inPoint);
    const loopDurationFrames = Math.round(loopDurationSec * fps);

    const loopSequences: React.ReactNode[] = [];
    for (let i = 0; i < fitResult.loops; i++) {
      const fromFrame = i * loopDurationFrames;
      if (fromFrame >= durationInFrames) break;
      const thisLoopDuration = Math.min(loopDurationFrames, durationInFrames - fromFrame);

      loopSequences.push(
        <Sequence key={i} from={fromFrame} durationInFrames={thisLoopDuration}>
          <OffthreadVideo
            src={src}
            startFrom={inPointInFrames}
            playbackRate={playbackRate}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </Sequence>,
      );
    }

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          backgroundColor: '#000',
        }}
      >
        {loopSequences}
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#000',
        overflow: 'hidden',
      }}
    >
      {videoElement}
    </div>
  );
};
