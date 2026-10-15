import React from 'react';

interface VoiceOrbProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  size?: number;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  isListening = false,
  isSpeaking = false,
  size = 140,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        margin: '0 auto',
      }}
      aria-hidden="true"
    >
      {/* Outer ambient wave */}
      <div
        style={{
          position: 'absolute',
          inset: -24,
          borderRadius: '50%',
          background: isListening
            ? 'radial-gradient(circle, rgba(239, 68, 68, 0.25) 0%, transparent 70%)'
            : isSpeaking
            ? 'radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(76, 141, 255, 0.2) 0%, transparent 70%)',
          animation: 'orbPulse 3s ease-in-out infinite',
          transition: 'all 0.5s ease',
        }}
      />

      {/* Mid glow ring */}
      <div
        style={{
          position: 'absolute',
          inset: -8,
          borderRadius: '50%',
          border: '1px solid rgba(76, 141, 255, 0.3)',
          background: isListening
            ? 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 80%)'
            : 'radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, transparent 80%)',
          animation: 'orbSpin 12s linear infinite',
          filter: 'blur(2px)',
        }}
      />

      {/* Core luminous orb */}
      <div
        style={{
          width: '70%',
          height: '70%',
          borderRadius: '50%',
          background: isListening
            ? 'linear-gradient(135deg, #EF4444 0%, #F59E0B 100%)'
            : isSpeaking
            ? 'linear-gradient(135deg, #38BDF8 0%, #4C8DFF 50%, #818CF8 100%)'
            : 'linear-gradient(135deg, #0284C7 0%, #2563EB 50%, #4F46E5 100%)',
          boxShadow: isSpeaking
            ? '0 0 35px rgba(56, 189, 248, 0.6), inset 0 0 15px rgba(255,255,255,0.6)'
            : '0 0 25px rgba(76, 141, 255, 0.4), inset 0 0 10px rgba(255,255,255,0.4)',
          transform: isListening || isSpeaking ? 'scale(1.08)' : 'scale(1)',
          transition: 'all 0.3s ease',
        }}
      />

      <style>{`
        @keyframes orbPulse {
          0%, 100% {
            transform: scale(0.96);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.9;
          }
        }
        @keyframes orbSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
