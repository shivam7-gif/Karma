import React from 'react';
import { Activity } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { DeviceToggle } from './DeviceToggle';
import { CONFIG } from '../config';
import { useAppStore } from '../store/appStore';

export const TopBar: React.FC = () => {
  const { tracePanelOpen, toggleTracePanel, traceItems } = useAppStore();

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px 32px 16px 32px',
        position: 'relative',
        zIndex: 20,
        width: '100%',
        minHeight: '64px',
      }}
    >
      {/* Top Left: Brand Mark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <BrandLogo size={28} />
      </div>

      {/* Top Center: Device Toggle & Trace Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <DeviceToggle />

        <button
          type="button"
          onClick={toggleTracePanel}
          aria-expanded={tracePanelOpen}
          aria-label="Toggle Trace Console"
          title="Toggle live execution trace"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: 'var(--radius-full)',
            background: tracePanelOpen ? 'rgba(76, 141, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${tracePanelOpen ? 'var(--accent-blue)' : 'var(--border-glass)'}`,
            color: tracePanelOpen ? 'var(--text-accent)' : 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all var(--transition-normal)',
          }}
        >
          <Activity size={13} />
          <span>Trace</span>
          {traceItems.length > 0 && (
            <span
              style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--accent-blue)',
                color: '#FFFFFF',
                fontWeight: 600,
              }}
            >
              {traceItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Top Right: Early Access Badge + User Avatar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-full)',
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            background: 'rgba(255, 255, 255, 0.03)',
            userSelect: 'none',
            letterSpacing: '0.01em',
          }}
        >
          Early Access
        </div>

        <button
          type="button"
          aria-label={`User profile for ${CONFIG.userName}`}
          title={`Signed in as ${CONFIG.userName}`}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid var(--border-glass-light)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all var(--transition-normal)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-blue)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-glass-light)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {CONFIG.userInitials}
        </button>
      </div>
    </header>
  );
};
