import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { Spike2aTimeline } from './components/Spike2aComposition';
import { Spike2bTimeline } from './components/Spike2bComposition';
import { Spike2cTimelineWithAudio, Spike2cTimelineSilent } from './components/Spike2cComposition';
import { Spike2dTimeline } from './components/Spike2dComposition';

const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Spike 2a: Remotion render - 3 clips + Ken Burns image */}
      <Composition
        id="Spike2aComposition"
        component={Spike2aTimeline}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />

      {/* Spike 2b: Emoji + styled caption rendering */}
      <Composition
        id="Spike2bComposition"
        component={Spike2bTimeline}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
      />

      {/* Spike 2c: Remotion Audio with ducking */}
      <Composition
        id="Spike2cAudioComposition"
        component={Spike2cTimelineWithAudio}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
      />

      {/* Spike 2c: Silent version for FFmpeg mux comparison */}
      <Composition
        id="Spike2cSilentComposition"
        component={Spike2cTimelineSilent}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
      />

      {/* Spike 2d: Frame accuracy - 10 scenes = 900 frames = 30.000s */}
      <Composition
        id="Spike2dComposition"
        component={Spike2dTimeline}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

registerRoot(RemotionRoot);
