import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { Caption as CaptionData } from '@scenestitch/core';
export const Caption: React.FC<{ caption: CaptionData; duration: number }> = ({
  caption,
  duration,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const time = frame / fps;
  if (time < caption.offset || time >= (caption.end ?? duration)) return null;
  const progress = Math.min(1, (time - caption.offset) / 0.18);
  const size = Math.min(width * 0.068, (width * 1.8) / Math.max(12, caption.text.length));
  const animation = caption.animation ?? 'pop';
  return (
    <div
      style={{
        position: 'absolute',
        left: '7%',
        right: '15%',
        bottom: '23%',
        textAlign: 'center',
        fontFamily: 'Arial, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
        fontSize: Math.max(width * 0.028, size),
        fontWeight: 900,
        lineHeight: 1.2,
        color: caption.style === 'yellow' ? '#ffe56b' : 'white',
        WebkitTextStroke: caption.style === 'boxed' ? undefined : `${width * 0.002}px #111`,
        paintOrder: 'stroke fill',
        textShadow: '0 3px 8px #000',
        background: caption.style === 'boxed' ? '#000c' : undefined,
        padding: '2%',
        borderRadius: 16,
        overflowWrap: 'anywhere',
        whiteSpace: 'pre-wrap',
        opacity: animation === 'fade' ? progress : 1,
        transform: animation === 'pop' ? `scale(${0.8 + 0.2 * progress})` : undefined,
      }}
    >
      {caption.text}
    </div>
  );
};
