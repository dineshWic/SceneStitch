import React from 'react';
import { Img, interpolate, useCurrentFrame } from 'remotion';
import type { CropMode } from '@scenestitch/core';

export interface KenBurnsImageProps {
  src: string;
  zoomFrom?: number;
  zoomTo?: number;
  crop?: CropMode;
  durationInFrames: number;
  alt?: string;
}

export const KenBurnsImage: React.FC<KenBurnsImageProps> = ({
  src,
  zoomFrom = 1.0,
  zoomTo = 1.05,
  crop = 'cover',
  durationInFrames,
  alt = 'Scene visual',
}) => {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [0, Math.max(1, durationInFrames)], [zoomFrom, zoomTo], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

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
        {/* Blurred background fill */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
          }}
        >
          <Img
            src={src}
            alt={alt}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(24px) brightness(0.5)',
              transform: 'scale(1.15)',
            }}
          />
        </div>

        {/* Foreground image with Ken Burns zoom */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Img
            src={src}
            alt={alt}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#000',
      }}
    >
      <Img
        src={src}
        alt={alt}
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
