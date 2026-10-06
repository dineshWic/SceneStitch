import React from 'react';
import { Composition, type CalculateMetadataFunction } from 'remotion';
import { buildFrameTimeline } from '@scenestitch/core';
import {
  MainComposition,
  MainCompositionSchema,
  type MainCompositionProps,
} from './components/MainComposition.js';

export const calculateProjectMetadata: CalculateMetadataFunction<MainCompositionProps> = async ({
  props,
}) => {
  const fps = props.project.settings?.fps ?? 30;
  const width = props.project.settings?.width ?? 1080;
  const height = props.project.settings?.height ?? 1920;
  const { totalFrames } = buildFrameTimeline(props.project.scenes ?? [], fps);

  return {
    durationInFrames: Math.max(1, totalFrames),
    fps,
    width,
    height,
  };
};

export const defaultProjectProps: MainCompositionProps = {
  project: {
    schemaVersion: 1,
    name: 'Default Composition',
    settings: {
      width: 1080,
      height: 1920,
      fps: 30,
      defaultFit: 'trim',
    },
    assets: [],
    scenes: [],
  },
};

export const Root: React.FC = () => {
  return (
    <Composition
      id="SceneStitchMain"
      component={MainComposition}
      schema={MainCompositionSchema}
      defaultProps={defaultProjectProps}
      calculateMetadata={calculateProjectMetadata}
    />
  );
};
