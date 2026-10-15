import React from 'react';
import { Activity } from 'lucide-react';
import { DeviceToggle } from './DeviceToggle';
import { CONFIG } from '../config';
import { useAppStore } from '../store/appStore';

export const TopBar: React.FC = () => {
  const { tracePanelOpen, toggleTracePanel, traceItems, user } = useAppStore();
  const displayName = user?.name || CONFIG.userName || 'Shiva';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 32px 12px 32px',
        position: 'relative',
        zIndex: 20,
        width: '100%',
        minHeight: '60px',
      }}
    >
      {/* Top Left: Spacer */}
      <div style={{ width: '32px' }} />

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
            borderRadius: '9999px',
            background: tracePanelOpen ? '#EFF6FF' : '#FFFFFF',
            border: `1px solid ${tracePanelOpen ? '#BFDBFE' : '#E2E8F0'}`,
            color: tracePanelOpen ? '#1D4ED8' : '#475569',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!tracePanelOpen) {
              e.currentTarget.style.background = '#F8FAFC';
              e.currentTarget.style.color = '#0F172A';
              e.currentTarget.style.borderColor = '#CBD5E1';
            }
          }}
          onMouseLeave={(e) => {
            if (!tracePanelOpen) {
              e.currentTarget.style.background = '#FFFFFF';
              e.currentTarget.style.color = '#475569';
              e.currentTarget.style.borderColor = '#E2E8F0';
            }
          }}
        >
          <Activity size={13} />
          <span>Trace</span>
          {traceItems.length > 0 && (
            <span
              style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '9999px',
                background: '#2563EB',
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
            border: '1px solid #E2E8F0',
            borderRadius: '9999px',
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#64748B',
            background: '#FFFFFF',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            userSelect: 'none',
            letterSpacing: '0.01em',
          }}
        >
          Early Access
        </div>

        <button
          type="button"
          aria-label={`User profile for ${displayName}`}
          title={`Signed in as ${displayName}`}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            color: '#1D4ED8',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2563EB';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#BFDBFE';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {user?.avatar ? (
            <img src={user.avatar} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initials
          )}
        </button>
      </div>
    </header>
  );
};
