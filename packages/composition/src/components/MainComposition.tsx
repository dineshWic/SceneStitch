import React from 'react';
import { Sequence, useCurrentFrame } from 'remotion';
import { z } from 'zod';
import {
  buildFrameTimeline,
  ProjectSchema,
  resolveVisual,
  type Project,
  type Scene,
} from '@scenestitch/core';
import { SceneVisual } from './SceneVisual.js';
import { Caption } from './Caption.js';
import { AudioTracks } from './AudioTracks.js';
export const MainCompositionSchema = z.object({ project: ProjectSchema });
export type MainCompositionProps = z.infer<typeof MainCompositionSchema>;
const Picture: React.FC<{ project: Project; scene: Scene; frames: number }> = ({
  project,
  scene,
  frames,
}) => {
  const get = (side?: 'left' | 'right') => {
    try {
      return resolveVisual(project, scene.id, side);
    } catch {
      return undefined;
    }
  };
  if (scene.template?.type === 'split-screen')
    return (
      <div style={{ display: 'flex', position: 'absolute', inset: 0 }}>
        {(['left', 'right'] as const).map((side) => (
          <div
            key={side}
            style={{
              width: '50%',
              position: 'relative',
              overflow: 'hidden',
              borderRight:
                side === 'left'
                  ? `4px solid ${scene.template?.dividerColor ?? 'white'}`
                  : undefined,
            }}
          >
            <SceneVisual
              asset={get(side)}
              visual={{
                assetId: '',
                fit: 'loop',
                inPoint: 0,
                crop: 'cover',
                motion: {
                  zoomFrom: scene.template?.zoom?.[0] ?? 1.02,
                  zoomTo: scene.template?.zoom?.[1] ?? 1.08,
                },
              }}
              durationInFrames={frames}
              fps={project.settings.fps}
            />
          </div>
        ))}
      </div>
    );
  return (
    <SceneVisual
      asset={get()}
      visual={scene.visual}
      durationInFrames={frames}
      fps={project.settings.fps}
    />
  );
};
const SceneLayer: React.FC<{
  project: Project;
  scene: Scene;
  previous?: Scene;
  frames: number;
}> = ({ project, scene, previous, frames }) => {
  const frame = useCurrentFrame();
  const transition =
    scene.transitionIn ??
    project.transitions?.find((t) => String(t.between[1]) === String(scene.id));
  const transitionFrames = Math.min(
    frames,
    Math.max(1, Math.round((transition?.duration ?? 0.25) * project.settings.fps)),
  );
  const progress = Math.min(1, frame / transitionFrames);
  const type = transition?.type ?? 'cut';
  return (
    <>
      {type === 'crossfade' && previous && progress < 1 ? (
        <Sequence
          from={
            -Math.max(
              0,
              Math.round((previous.end - previous.start) * project.settings.fps) - transitionFrames,
            )
          }
          layout="none"
        >
          <Picture
            project={project}
            scene={previous}
            frames={Math.round((previous.end - previous.start) * project.settings.fps)}
          />
        </Sequence>
      ) : null}
      <div style={{ position: 'absolute', inset: 0, opacity: type === 'crossfade' ? progress : 1 }}>
        <Picture project={project} scene={scene} frames={frames} />
      </div>
      {type === 'flash' || type === 'dip-to-black' ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: type === 'flash' ? 'white' : 'black',
            opacity: 1 - progress,
          }}
        />
      ) : null}
      {scene.caption ? (
        <Caption caption={scene.caption} duration={frames / project.settings.fps} />
      ) : null}
    </>
  );
};
export const MainComposition: React.FC<MainCompositionProps> = ({ project }) => {
  const { computedScenes } = buildFrameTimeline(project.scenes, project.settings.fps);
  return (
    <div
      style={{
        width: project.settings.width,
        height: project.settings.height,
        background: '#000',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {computedScenes.map((computed, i) =>
        computed.durationInFrames > 0 ? (
          <Sequence key={i} from={computed.startFrame} durationInFrames={computed.durationInFrames}>
            <SceneLayer
              project={project}
              scene={project.scenes[i]!}
              previous={project.scenes[i - 1]}
              frames={computed.durationInFrames}
            />
          </Sequence>
        ) : null,
      )}
      <AudioTracks project={project} />
    </div>
  );
};
