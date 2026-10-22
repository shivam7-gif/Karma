import React from 'react';
import { Activity, Settings } from 'lucide-react';
import { DeviceToggle } from './DeviceToggle';
import { APP_NAME, CONFIG } from '../config';
import { useAppStore } from '../store/appStore';

const NAV_TITLES: Record<string, string> = {
  home: 'Home',
  history: 'History',
  ideas: 'Ideas',
  calendar: 'Calendar',
  lists: 'Lists',
  tasks: 'Tasks',
  insights: 'Insights',
};

export const TopBar: React.FC = () => {
  const { tracePanelOpen, toggleTracePanel, traceItems, user, activeNav, openSettings } = useAppStore();
  const displayName = user?.name || CONFIG.userName || 'Shiva';
  const initials = displayName.charAt(0).toUpperCase();
  const currentPageTitle = NAV_TITLES[activeNav] || 'Home';

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 28px 12px 28px',
        position: 'relative',
        zIndex: 20,
        width: '100%',
        minHeight: '56px',
      }}
    >
      {/* Top Left: Active Section Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-secondary, #575260)',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}
        >
          {currentPageTitle}
        </span>
      </div>

      {/* Top Center: Device Toggle & Trace Console Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <DeviceToggle />

        <button
          type="button"
          onClick={toggleTracePanel}
          aria-expanded={tracePanelOpen}
          aria-label="Toggle execution trace panel"
          title="Execution trace: records live MCP tool invocations, latencies, and responses"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: 'var(--r-full, 9999px)',
            background: tracePanelOpen ? 'var(--accent-soft, rgba(139, 61, 255, 0.08))' : '#ffffff',
            border: `1px solid ${tracePanelOpen ? 'var(--accent, #8b3dff)' : 'var(--border-glass, #e7e2d8)'}`,
            color: tracePanelOpen ? 'var(--accent, #8b3dff)' : 'var(--text-secondary, #575260)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-soft, 0 1px 2px rgba(0, 0, 0, 0.03))',
            transition: 'all var(--transition-hover, 120ms ease)',
          }}
          onMouseEnter={(e) => {
            if (!tracePanelOpen) {
              e.currentTarget.style.background = 'var(--surface-glass-hover, #f5f2ec)';
              e.currentTarget.style.color = 'var(--text-primary, #19161d)';
            }
          }}
          onMouseLeave={(e) => {
            if (!tracePanelOpen) {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.color = 'var(--text-secondary, #575260)';
            }
          }}
        >
          <Activity size={13} strokeWidth={1.8} />
          <span>Trace</span>
          {traceItems.length > 0 && (
            <span
              title={`${traceItems.length} tool executions logged in trace`}
              style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: 'var(--r-full, 9999px)',
                background: 'var(--accent, #8b3dff)',
                color: '#ffffff',
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
          gap: '10px',
        }}
      >
        <div
          title={`${APP_NAME} Preview: early build testing voice and MCP streaming capabilities`}
          style={{
            border: '1px solid var(--border-glass, #e7e2d8)',
            borderRadius: 'var(--r-full, 9999px)',
            padding: '4px 11px',
            fontSize: '11.5px',
            fontWeight: 500,
            color: 'var(--text-muted, #8e8798)',
            background: '#ffffff',
            boxShadow: 'var(--shadow-soft, 0 1px 2px rgba(0, 0, 0, 0.03))',
            userSelect: 'none',
            letterSpacing: '0.01em',
            cursor: 'help',
          }}
        >
          Early Access
        </div>

        <button
          type="button"
          onClick={openSettings}
          aria-label="AI Engine & Key Settings"
          title="Open AI Engine & API Key Settings"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#ffffff',
            border: '1px solid var(--border-glass, #e7e2d8)',
            color: 'var(--text-secondary, #575260)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all var(--transition-hover, 120ms ease)',
            boxShadow: 'var(--shadow-soft, 0 1px 2px rgba(0, 0, 0, 0.04))',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent, #8b3dff)';
            e.currentTarget.style.color = 'var(--accent, #8b3dff)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-glass, #e7e2d8)';
            e.currentTarget.style.color = 'var(--text-secondary, #575260)';
          }}
        >
          <Settings size={15} strokeWidth={1.8} />
        </button>

        <button
          type="button"
          onClick={openSettings}
          aria-label={`User profile for ${displayName}`}
          title={`Signed in as ${displayName} (click to view settings)`}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--accent-soft, rgba(139, 61, 255, 0.08))',
            border: '1px solid rgba(139, 61, 255, 0.2)',
            color: 'var(--accent, #8b3dff)',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all var(--transition-hover, 120ms ease)',
            boxShadow: 'var(--shadow-soft, 0 1px 2px rgba(0, 0, 0, 0.04))',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent, #8b3dff)';
            e.currentTarget.style.transform = 'scale(1.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(139, 61, 255, 0.2)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {user?.avatar ? (
            <img src={user.avatar} alt={`${APP_NAME} avatar for ${displayName}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initials
          )}
        </button>
      </div>
    </header>
  );
};

export default TopBar;
