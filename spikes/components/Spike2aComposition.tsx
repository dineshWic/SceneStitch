import React from 'react';
import {
  Composition,
  Sequence,
  OffthreadVideo,
  Img,
  interpolate,
  useCurrentFrame,
  staticFile,
} from 'remotion';

export interface KenBurnsProps {
  src: string;
  zoomFrom: number;
  zoomTo: number;
  durationInFrames: number;
}

export const KenBurnsImage: React.FC<KenBurnsProps> = ({
  src,
  zoomFrom,
  zoomTo,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, durationInFrames], [zoomFrom, zoomTo], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
      }}
    >
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      />
    </div>
  );
};

export const Spike2aTimeline: React.FC = () => {
  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: '#000',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Scene 1: clip01.mp4 (0 to 90 frames = 3.0s) */}
      <Sequence from={0} durationInFrames={90}>
        <OffthreadVideo
          src={staticFile('clip01.mp4')}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </Sequence>

      {/* Scene 2: clip02.mp4 (90 to 210 frames = 4.0s) */}
      <Sequence from={90} durationInFrames={120}>
        <OffthreadVideo
          src={staticFile('clip02.mp4')}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </Sequence>

      {/* Scene 3: clip03.mp4 (210 to 360 frames = 5.0s) */}
      <Sequence from={210} durationInFrames={150}>
        <OffthreadVideo
          src={staticFile('clip03.mp4')}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </Sequence>

      {/* Scene 4: image01.png with Ken Burns zoom (360 to 450 frames = 3.0s) */}
      <Sequence from={360} durationInFrames={90}>
        <KenBurnsImage
          src={staticFile('image01.png')}
          zoomFrom={1.0}
          zoomTo={1.15}
          durationInFrames={90}
        />
      </Sequence>
    </div>
  );
};

export const Spike2aRoot: React.FC = () => {
  return (
    <Composition
      id="Spike2aComposition"
      component={Spike2aTimeline}
      durationInFrames={450}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
