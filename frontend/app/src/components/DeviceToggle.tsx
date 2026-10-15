import React from 'react';
import { Mic, Monitor } from 'lucide-react';
import { useAppStore } from '../store/appStore';

export const DeviceToggle: React.FC = () => {
  const { deviceMode, setDeviceMode } = useAppStore();

  return (
    <div
      role="group"
      aria-label="Device simulation mode"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius-full)',
        padding: '3px',
        backdropFilter: 'var(--blur-glass)',
        gap: '2px',
      }}
    >
      <button
        type="button"
        onClick={() => setDeviceMode('voice-only')}
        aria-pressed={deviceMode === 'voice-only'}
        title="Echo (Voice only) mode"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: 'var(--radius-full)',
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          fontFamily: 'inherit',
          transition: 'all var(--transition-normal)',
          background: deviceMode === 'voice-only' ? 'var(--accent-blue)' : 'transparent',
          color: deviceMode === 'voice-only' ? '#FFFFFF' : 'var(--text-secondary)',
          boxShadow: deviceMode === 'voice-only' ? '0 2px 8px rgba(76, 141, 255, 0.35)' : 'none',
        }}
      >
        <Mic size={13} />
        <span>Echo</span>
      </button>

      <button
        type="button"
        onClick={() => setDeviceMode('screen')}
        aria-pressed={deviceMode === 'screen'}
        title="Echo Show (Screen + Voice) mode"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: 'var(--radius-full)',
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          fontFamily: 'inherit',
          transition: 'all var(--transition-normal)',
          background: deviceMode === 'screen' ? 'var(--accent-blue)' : 'transparent',
          color: deviceMode === 'screen' ? '#FFFFFF' : 'var(--text-secondary)',
          boxShadow: deviceMode === 'screen' ? '0 2px 8px rgba(76, 141, 255, 0.35)' : 'none',
        }}
      >
        <Monitor size={13} />
        <span>Echo Show</span>
      </button>
    </div>
  );
};
