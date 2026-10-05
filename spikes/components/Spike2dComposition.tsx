import React from 'react';
import { Composition, Sequence, useCurrentFrame } from 'remotion';

export interface SceneSpec {
  id: number;
  label: string;
  startSec: number;
  endSec: number;
  bgColor: string;
}

export const REFERENCE_SCENES: SceneSpec[] = [
  { id: 1, label: 'Salon Hook', startSec: 0.0, endSec: 2.2, bgColor: '#1E1E2E' },
  { id: 2, label: 'Muddy Condition', startSec: 2.2, endSec: 4.5, bgColor: '#181825' },
  { id: 3, label: 'Warm Rinse', startSec: 4.5, endSec: 7.3, bgColor: '#11111B' },
  { id: 4, label: 'Foam Bath', startSec: 7.3, endSec: 10.1, bgColor: '#313244' },
  { id: 5, label: 'Gentle Brush', startSec: 10.1, endSec: 13.0, bgColor: '#45475A' },
  { id: 6, label: 'Rinse Reveal', startSec: 13.0, endSec: 16.1, bgColor: '#585B70' },
  { id: 7, label: 'Blow-Dry', startSec: 16.1, endSec: 19.3, bgColor: '#2E3440' },
  { id: 8, label: 'Coat Finishing', startSec: 19.3, endSec: 22.3, bgColor: '#3B4252' },
  { id: 9, label: 'Glamorous Reveal', startSec: 22.3, endSec: 27.2, bgColor: '#434C5E' },
  { id: 10, label: 'Before/After CTA', startSec: 27.2, endSec: 30.0, bgColor: '#4C566A' },
];

export interface ComputedSceneFrame {
  id: number;
  label: string;
  startFrame: number;
  endFrame: number;
  durationInFrames: number;
  bgColor: string;
}

export function computeSceneFrames(
  scenes: SceneSpec[],
  fps: number = 30,
): ComputedSceneFrame[] {
  return scenes.map((scene, index) => {
    // Boundary rounding rule:
    // First scene starts at frame 0.
    // Subsequent scene startFrame equals the previous scene's endFrame.
    const startFrame =
      index === 0 ? Math.round(scene.startSec * fps) : Math.round(scene.startSec * fps);
    const endFrame = Math.round(scene.endSec * fps);
    const durationInFrames = endFrame - startFrame;

    return {
      id: scene.id,
      label: scene.label,
      startFrame,
      endFrame,
      durationInFrames,
      bgColor: scene.bgColor,
    };
  });
}

export const SceneCard: React.FC<{
  scene: ComputedSceneFrame;
  globalFps: number;
}> = ({ scene, globalFps }) => {
  const frameInScene = useCurrentFrame();
  const absoluteFrame = scene.startFrame + frameInScene;
  const timeSec = (absoluteFrame / globalFps).toFixed(2);

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: scene.bgColor,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#FFFFFF',
        fontFamily: 'monospace',
        padding: 60,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          fontSize: 80,
          fontWeight: 'bold',
          marginBottom: 20,
          color: '#89B4FA',
        }}
      >
        Scene {scene.id}
      </div>
      <div style={{ fontSize: 50, marginBottom: 40, textAlign: 'center' }}>
        {scene.label}
      </div>
      <div
        style={{
          fontSize: 36,
          background: 'rgba(0,0,0,0.5)',
          padding: '24px 40px',
          borderRadius: 16,
          lineHeight: 1.6,
        }}
      >
        <div>
          Frames: {scene.startFrame} → {scene.endFrame} ({scene.durationInFrames}{' '}
          frames)
        </div>
        <div>Current Scene Frame: {frameInScene}</div>
        <div>Global Frame: {absoluteFrame} / 900</div>
        <div>Timeline Time: {timeSec}s / 30.00s</div>
      </div>
    </div>
  );
};

export const Spike2dTimeline: React.FC = () => {
  const computedScenes = computeSceneFrames(REFERENCE_SCENES, 30);

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: '#000',
        position: 'relative',
      }}
    >
      {computedScenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
        >
          <SceneCard scene={scene} globalFps={30} />
        </Sequence>
      ))}
    </div>
  );
};

export const Spike2dRoot: React.FC = () => {
  return (
    <Composition
      id="Spike2dComposition"
      component={Spike2dTimeline}
      durationInFrames={900}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
