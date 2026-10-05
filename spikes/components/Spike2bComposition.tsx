import React from 'react';
import { Composition, Sequence, OffthreadVideo, staticFile } from 'remotion';

export interface CaptionStyleProps {
  text: string;
  fontSize?: number;
  textColor?: string;
  strokeColor?: string;
  backgroundColor?: string;
  yPosition?: number;
}

export const StyledCaption: React.FC<CaptionStyleProps> = ({
  text,
  fontSize = 64,
  textColor = '#FFE600',
  strokeColor = '#000000',
  backgroundColor = 'rgba(0, 0, 0, 0.75)',
  yPosition = 1400,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: yPosition,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 40px',
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: backgroundColor,
          borderRadius: 24,
          padding: '24px 44px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Color Emoji", sans-serif',
            fontSize,
            fontWeight: 900,
            color: textColor,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            WebkitTextStroke: `4px ${strokeColor}`,
            paintOrder: 'stroke fill',
            textShadow: '0 6px 12px rgba(0, 0, 0, 0.9)',
            display: 'inline-block',
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};

export const Spike2bTimeline: React.FC = () => {
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
      <OffthreadVideo
        src={staticFile('clip01.mp4')}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      <Sequence from={0} durationInFrames={45}>
        <StyledCaption
          text="🧼 SOAPY CAPYBARA ✨"
          fontSize={72}
          textColor="#FFF066"
          yPosition={1350}
        />
      </Sequence>

      <Sequence from={45} durationInFrames={45}>
        <StyledCaption
          text="100% SATISFYING 🦫 🛁"
          fontSize={68}
          textColor="#66FFCC"
          yPosition={1350}
        />
      </Sequence>
    </div>
  );
};

export const Spike2bRoot: React.FC = () => {
  return (
    <Composition
      id="Spike2bComposition"
      component={Spike2bTimeline}
      durationInFrames={90}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
