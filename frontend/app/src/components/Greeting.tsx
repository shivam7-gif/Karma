import React from 'react';
import { CONFIG } from '../config';

interface GreetingProps {
  className?: string;
  style?: React.CSSProperties;
}

export const Greeting: React.FC<GreetingProps> = ({ className = '', style }) => {
  return (
    <div
      className={`assistant-greeting ${className}`}
      style={{
        textAlign: 'center',
        marginBottom: '28px',
        userSelect: 'none',
        ...style,
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-greeting-size)',
          fontWeight: 'var(--text-greeting-weight)',
          color: 'var(--text-primary)',
          letterSpacing: '-0.025em',
          lineHeight: 1.25,
          margin: 0,
          textShadow: '0 2px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        Hello {CONFIG.userName}, how can I help?
      </h1>
    </div>
  );
};
