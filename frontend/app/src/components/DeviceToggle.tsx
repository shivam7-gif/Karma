import React from 'react';
import { Mic, Monitor } from 'lucide-react';
import { useAppStore } from '../store/appStore';

export const DeviceToggle: React.FC = () => {
  const { deviceMode, setDeviceMode, openVoiceModal } = useAppStore();

  const handleVoiceClick = () => {
    setDeviceMode('voice-only');
    openVoiceModal();
  };

  return (
    <div
      role="group"
      aria-label="Interface mode toggle"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: '#ffffff',
        border: '1px solid var(--border-glass, #e7e2d8)',
        borderRadius: 'var(--r-full, 9999px)',
        padding: '3px',
        boxShadow: 'var(--shadow-soft, 0 1px 3px rgba(0, 0, 0, 0.03))',
        gap: '2px',
      }}
    >
      <button
        type="button"
        onClick={handleVoiceClick}
        aria-pressed={deviceMode === 'voice-only'}
        title="Voice mode: launch the full-screen animated aurora orb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: 'var(--r-full, 9999px)',
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          transition: 'all var(--transition-hover, 120ms ease)',
          background: deviceMode === 'voice-only' ? 'var(--accent, #8b3dff)' : 'transparent',
          color: deviceMode === 'voice-only' ? '#ffffff' : 'var(--text-secondary, #575260)',
        }}
        onMouseEnter={(e) => {
          if (deviceMode !== 'voice-only') {
            e.currentTarget.style.color = 'var(--text-primary, #19161d)';
            e.currentTarget.style.background = 'var(--surface-glass-hover, #f5f2ec)';
          }
        }}
        onMouseLeave={(e) => {
          if (deviceMode !== 'voice-only') {
            e.currentTarget.style.color = 'var(--text-secondary, #575260)';
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <Mic size={13} strokeWidth={1.8} />
        <span>Voice</span>
      </button>

      <button
        type="button"
        onClick={() => setDeviceMode('screen')}
        aria-pressed={deviceMode === 'screen'}
        title="Screen mode: conversational transcript and cards"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: 'var(--r-full, 9999px)',
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          transition: 'all var(--transition-hover, 120ms ease)',
          background: deviceMode === 'screen' ? 'var(--accent, #8b3dff)' : 'transparent',
          color: deviceMode === 'screen' ? '#ffffff' : 'var(--text-secondary, #575260)',
        }}
        onMouseEnter={(e) => {
          if (deviceMode !== 'screen') {
            e.currentTarget.style.color = 'var(--text-primary, #19161d)';
            e.currentTarget.style.background = 'var(--surface-glass-hover, #f5f2ec)';
          }
        }}
        onMouseLeave={(e) => {
          if (deviceMode !== 'screen') {
            e.currentTarget.style.color = 'var(--text-secondary, #575260)';
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <Monitor size={13} strokeWidth={1.8} />
        <span>Screen</span>
      </button>
    </div>
  );
};

export default DeviceToggle;
