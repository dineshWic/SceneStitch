import React from 'react';
import { Sequence } from 'remotion';
import { z } from 'zod';
import {
  buildFrameTimeline,
  ProjectSchema,
  type Asset,
} from '@scenestitch/core';
import { SceneVisual } from './SceneVisual.js';

export const MainCompositionSchema = z.object({
  project: ProjectSchema,
});
export type MainCompositionProps = z.infer<typeof MainCompositionSchema>;

export const MainComposition: React.FC<MainCompositionProps> = ({ project }) => {
  const fps = project.settings.fps ?? 30;
  const width = project.settings.width ?? 1080;
  const height = project.settings.height ?? 1920;

  const assetMap = React.useMemo(() => {
    const map: Record<string, Asset> = {};
    for (const asset of project.assets) {
      map[asset.id] = asset;
    }
    return map;
  }, [project.assets]);

  const { computedScenes } = React.useMemo(
    () => buildFrameTimeline(project.scenes, fps),
    [project.scenes, fps],
  );

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#000000',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {computedScenes.map((computedScene, index) => {
        const rawScene = project.scenes[index];
        if (!rawScene) return null;

        const asset = rawScene.visual?.assetId
          ? assetMap[rawScene.visual.assetId]
          : undefined;

        return (
          <Sequence
            key={rawScene.id}
            from={computedScene.startFrame}
            durationInFrames={computedScene.durationInFrames}
          >
            <SceneVisual
              asset={asset}
              visual={rawScene.visual}
              durationInFrames={computedScene.durationInFrames}
              fps={fps}
            />
          </Sequence>
        );
      })}
    </div>
  );
};
