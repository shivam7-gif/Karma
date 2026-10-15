import React from 'react';
import { KineticTextReveal } from "@/components/ui/kinetic-text-reveal";
import { CONFIG } from '../config';
import { useAppStore } from '../store/appStore';

interface GreetingProps {
  className?: string;
  style?: React.CSSProperties;
}

export const Greeting: React.FC<GreetingProps> = ({ className = '', style }) => {
  const { user } = useAppStore();
  const userName = user?.name || CONFIG.userName || 'Shiva';

  return (
    <div
      className={`assistant-greeting ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        marginBottom: '28px',
        userSelect: 'none',
        ...style,
      }}
    >
      <div style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
        <KineticTextReveal
          key={userName}
          text={`Hello ${userName}, how can I help?`}
          splitBy="characters"
          stagger={0.025}
          distance={16}
          staggerFrom="center"
          className="text-5xl font-bold tracking-tight justify-center"
        />
      </div>
      <div style={{ color: 'var(--text-secondary)' }}>
        <KineticTextReveal
          text="Ask questions, search through your documents, or plan your day."
          splitBy="words"
          stagger={0.04}
          delay={0.25}
          distance={12}
          staggerFrom="start"
          className="text-base font-normal justify-center"
        />
      </div>
    </div>
  );
};
