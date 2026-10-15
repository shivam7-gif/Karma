import React from 'react';
import { CONFIG } from '../config';

interface BrandLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export const BrandRingIcon: React.FC<{ size?: number; className?: string }> = ({ size = 26, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="brandRingGrad" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#4C8DFF" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>
        <filter id="brandGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="glow" />
          <feComposite in="SourceGraphic" in2="glow" operator="over" />
        </filter>
      </defs>
      {/* Outer ambient soft ring */}
      <circle
        cx="14"
        cy="14"
        r="11"
        stroke="url(#brandRingGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="50 16"
        transform="rotate(-45 14 14)"
        filter="url(#brandGlow)"
      />
      {/* Inner luminous node */}
      <circle
        cx="14"
        cy="5.5"
        r="2.2"
        fill="#FFFFFF"
        filter="drop-shadow(0 0 3px #38BDF8)"
      />
      <circle
        cx="14"
        cy="14"
        r="3.5"
        fill="url(#brandRingGrad)"
        opacity="0.8"
      />
    </svg>
  );
};

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 26, showText = true, className = '' }) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        userSelect: 'none',
      }}
      className={className}
    >
      <BrandRingIcon size={size} />
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '17px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.15,
            }}
          >
            Karma Echo
          </h2>
          <p
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--accent-blue)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            Voice Intelligence
          </p>
        </div>
      )}
    </div>
  );
};
