import React from 'react';
import { Mic, Monitor } from 'lucide-react';
import { useAppStore } from '../store/appStore';

export const DeviceToggle: React.FC = () => {
  const { deviceMode, setDeviceMode, openVoiceModal } = useAppStore();

  const handleEchoClick = () => {
    setDeviceMode('voice-only');
    openVoiceModal();
  };

  return (
    <div
      role="group"
      aria-label="Device simulation mode"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '9999px',
        padding: '3px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        gap: '2px',
      }}
    >
      <button
        type="button"
        onClick={handleEchoClick}
        aria-pressed={deviceMode === 'voice-only'}
        title="Echo (Voice only) mode - launches Aurora Voice Agent"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '9999px',
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          fontFamily: 'inherit',
          transition: 'all 0.15s ease',
          background: deviceMode === 'voice-only' ? '#2563EB' : 'transparent',
          color: deviceMode === 'voice-only' ? '#FFFFFF' : '#64748B',
          boxShadow: deviceMode === 'voice-only' ? '0 1px 2px rgba(0, 0, 0, 0.08)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (deviceMode !== 'voice-only') {
            e.currentTarget.style.color = '#0F172A';
            e.currentTarget.style.background = '#F1F5F9';
          }
        }}
        onMouseLeave={(e) => {
          if (deviceMode !== 'voice-only') {
            e.currentTarget.style.color = '#64748B';
            e.currentTarget.style.background = 'transparent';
          }
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
          borderRadius: '9999px',
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          fontFamily: 'inherit',
          transition: 'all 0.15s ease',
          background: deviceMode === 'screen' ? '#2563EB' : 'transparent',
          color: deviceMode === 'screen' ? '#FFFFFF' : '#64748B',
          boxShadow: deviceMode === 'screen' ? '0 1px 2px rgba(0, 0, 0, 0.08)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (deviceMode !== 'screen') {
            e.currentTarget.style.color = '#0F172A';
            e.currentTarget.style.background = '#F1F5F9';
          }
        }}
        onMouseLeave={(e) => {
          if (deviceMode !== 'screen') {
            e.currentTarget.style.color = '#64748B';
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <Monitor size={13} />
        <span>Echo Show</span>
      </button>
    </div>
  );
};
