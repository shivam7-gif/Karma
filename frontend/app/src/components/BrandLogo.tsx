import React from 'react';

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
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      {/* Outer refined ring */}
      <circle
        cx="14"
        cy="14"
        r="11"
        stroke="url(#brandRingGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="50 16"
        transform="rotate(-45 14 14)"
      />
      {/* Inner node */}
      <circle
        cx="14"
        cy="5.5"
        r="2.2"
        fill="#2563EB"
      />
      <circle
        cx="14"
        cy="14"
        r="3"
        fill="#2563EB"
        opacity="0.85"
      />
    </svg>
  );
};

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 26, className = '' }) => {
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
    </div>
  );
};
