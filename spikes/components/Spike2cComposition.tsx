import React from 'react';
import { Composition, Sequence, OffthreadVideo, Audio, interpolate, staticFile } from 'remotion';

export const calculateMusicVolume = (frame: number): number => {
  // Voiceover runs from frame 0 to 75 (2.5 seconds @ 30 fps)
  const DUCK_START = 0;
  const DUCK_END = 75;
  const FADE_IN_FRAMES = 5;
  const FADE_OUT_FRAMES = 10;
  const BASE_VOLUME = 0.8;
  const DUCKED_VOLUME = 0.15;

  if (frame < DUCK_START) {
    return BASE_VOLUME;
  }
  if (frame < DUCK_START + FADE_IN_FRAMES) {
    return interpolate(
      frame,
      [DUCK_START, DUCK_START + FADE_IN_FRAMES],
      [BASE_VOLUME, DUCKED_VOLUME],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
  }
  if (frame <= DUCK_END) {
    return DUCKED_VOLUME;
  }
  if (frame < DUCK_END + FADE_OUT_FRAMES) {
    return interpolate(
      frame,
      [DUCK_END, DUCK_END + FADE_OUT_FRAMES],
      [DUCKED_VOLUME, BASE_VOLUME],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
  }
  return BASE_VOLUME;
};

export const Spike2cTimelineWithAudio: React.FC = () => {
  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: '#050510',
        position: 'relative',
      }}
    >
      <OffthreadVideo
        src={staticFile('clip03.mp4')}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Voiceover Track (frames 0 to 75 = 2.5s) */}
      <Sequence from={0} durationInFrames={75}>
        <Audio src={staticFile('voiceover01.mp3')} />
      </Sequence>

      {/* Music Track with dynamic ducking volume function */}
      <Audio src={staticFile('music01.mp3')} volume={(frame) => calculateMusicVolume(frame)} />
    </div>
  );
};

export const Spike2cTimelineSilent: React.FC = () => {
  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: '#050510',
        position: 'relative',
      }}
    >
      <OffthreadVideo
        src={staticFile('clip03.mp4')}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
};

export const Spike2cRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Spike2cAudioComposition"
        component={Spike2cTimelineWithAudio}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Spike2cSilentComposition"
        component={Spike2cTimelineSilent}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
