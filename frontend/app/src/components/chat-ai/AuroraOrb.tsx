import React from 'react';
import SoftAurora from './SoftAurora';
import type { AudioLevelData } from './SoftAurora';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface AuroraOrbProps {
  state?: VoiceState;
  size?: number;
  audioLevelRef?: React.RefObject<AudioLevelData | number | null>;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const AuroraOrb: React.FC<AuroraOrbProps> = ({
  state = 'idle',
  size = 220,
  audioLevelRef,
  onClick,
  className = '',
  style,
}) => {
  // Configure visual styling and colors per voice state
  const stateConfigs = {
    idle: {
      color1: '#f8fafc',
      color2: '#6366f1', // gentle indigo
      brightness: 0.75,
      speed: 0.4,
      noiseAmplitude: 0.85,
      noiseFrequency: 2.2,
      glowColor: 'rgba(99, 102, 241, 0.35)',
      ringColor: 'rgba(99, 102, 241, 0.25)',
      statusLabel: 'Idle',
    },
    listening: {
      color1: '#e0f2fe',
      color2: '#0284c7', // vibrant blue
      brightness: 1.15,
      speed: 0.7,
      noiseAmplitude: 1.25,
      noiseFrequency: 2.6,
      glowColor: 'rgba(2, 132, 199, 0.55)',
      ringColor: 'rgba(56, 189, 248, 0.45)',
      statusLabel: 'Listening...',
    },
    thinking: {
      color1: '#fdf4ff',
      color2: '#8b5cf6', // shimmer violet
      brightness: 1.05,
      speed: 1.1,
      noiseAmplitude: 1.1,
      noiseFrequency: 3.2,
      glowColor: 'rgba(139, 92, 246, 0.45)',
      ringColor: 'rgba(192, 132, 252, 0.35)',
      statusLabel: 'Thinking...',
    },
    speaking: {
      color1: '#ffffff',
      color2: '#e100ff', // reactive purple/magenta
      brightness: 1.35,
      speed: 0.95,
      noiseAmplitude: 1.45,
      noiseFrequency: 2.8,
      glowColor: 'rgba(225, 0, 255, 0.6)',
      ringColor: 'rgba(232, 121, 249, 0.5)',
      statusLabel: 'Speaking...',
    },
  };

  const current = stateConfigs[state];

  return (
    <div
      className={`aurora-orb-wrapper ${className}`}
      onClick={onClick}
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Outer ambient soft glow aura */}
      <div
        className="aurora-orb__glow"
        style={{
          position: 'absolute',
          inset: '-22px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${current.glowColor} 0%, rgba(0,0,0,0) 70%)`,
          filter: 'blur(16px)',
          opacity: state === 'idle' ? 0.6 : 0.95,
          transition: 'all 0.4s ease',
          pointerEvents: 'none',
          animation: state === 'thinking' ? 'auroraShimmer 2s ease-in-out infinite' : undefined,
        }}
      />

      {/* Pulsing state ring */}
      <div
        className="aurora-orb__ring"
        style={{
          position: 'absolute',
          inset: '-6px',
          borderRadius: '50%',
          border: `1.5px solid ${current.ringColor}`,
          boxShadow: `0 0 16px ${current.glowColor}`,
          transition: 'all 0.35s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Small circular div container (220px, overflow hidden, dark background, soft glow) */}
      <div
        className="aurora-orb__inner"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          background: '#090b14',
          position: 'relative',
          boxShadow: `inset 0 0 24px rgba(0, 0, 0, 0.8), 0 8px 32px rgba(0, 0, 0, 0.4)`,
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        <SoftAurora
          speed={current.speed}
          scale={1.4}
          brightness={current.brightness}
          color1={current.color1}
          color2={current.color2}
          noiseAmplitude={current.noiseAmplitude}
          noiseFrequency={current.noiseFrequency}
          bandHeight={0.5}
          bandSpread={1.05}
          octaveDecay={0.12}
          enableMouseInteraction={true}
          mouseInfluence={0.3}
          clickPulse={true}
          intro={false}
          audioLevelRef={audioLevelRef}
        />
      </div>

      <style>{`
        @keyframes auroraShimmer {
          0%, 100% {
            transform: scale(0.96);
            opacity: 0.65;
          }
          50% {
            transform: scale(1.08);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default AuroraOrb;
