import React, { useRef, useState, useEffect } from 'react';
import { Settings, Mic, Monitor, Activity } from 'lucide-react';
import { CONFIG } from '../config';
import { useAppStore } from '../store/appStore';

const NAV_TITLES: Record<string, string> = {
  home: 'Dashboard',
  ide: 'IDE Workspace',
  history: 'History',
  ideas: 'Ideas',
  calendar: 'Calendar',
  lists: 'Lists',
  tasks: 'Tasks',
  insights: 'Analytics',
};

type SegmentMode = 'voice' | 'screen' | 'trace';

export const TopBar: React.FC = () => {
  const {
    tracePanelOpen,
    toggleTracePanel,
    traceItems,
    user,
    activeNav,
    openSettings,
    deviceMode,
    setDeviceMode,
    openVoiceModal,
    isVoiceModalOpen,
  } = useAppStore();

  const displayName = user?.name || CONFIG.userName || 'Shiva';
  const initials = displayName.charAt(0).toUpperCase();
  const currentPageTitle = NAV_TITLES[activeNav] || 'Dashboard';

  // Determine active segment
  const activeSegment: SegmentMode = tracePanelOpen
    ? 'trace'
    : deviceMode === 'voice-only' || isVoiceModalOpen
    ? 'voice'
    : 'screen';

  const containerRef = useRef<HTMLDivElement>(null);
  const voiceBtnRef = useRef<HTMLButtonElement>(null);
  const screenBtnRef = useRef<HTMLButtonElement>(null);
  const traceBtnRef = useRef<HTMLButtonElement>(null);

  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 3, width: 70 });

  // Update sliding pill indicator position
  useEffect(() => {
    let targetBtn: HTMLButtonElement | null = null;
    if (activeSegment === 'voice') targetBtn = voiceBtnRef.current;
    else if (activeSegment === 'screen') targetBtn = screenBtnRef.current;
    else if (activeSegment === 'trace') targetBtn = traceBtnRef.current;

    if (targetBtn && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const btnRect = targetBtn.getBoundingClientRect();
      setPillStyle({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
    }
  }, [activeSegment]);

  const handleSegmentClick = (mode: SegmentMode) => {
    if (mode === 'voice') {
      if (tracePanelOpen) toggleTracePanel();
      setDeviceMode('voice-only');
      openVoiceModal();
    } else if (mode === 'screen') {
      if (tracePanelOpen) toggleTracePanel();
      setDeviceMode('screen');
    } else if (mode === 'trace') {
      if (!tracePanelOpen) toggleTracePanel();
    }
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 28px',
        position: 'relative',
        zIndex: 30,
        width: '100%',
        minHeight: '56px',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Left: Breadcrumb-style label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            fontWeight: 500,
            color: '#8E8798',
            letterSpacing: '0.01em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>Karma</span>
          <span style={{ color: '#D8D2C7' }}>/</span>
          <span style={{ color: '#575260' }}>{currentPageTitle}</span>
        </span>
      </div>

      {/* Top Center: Unified Segmented Control (Voice | Screen | Trace) */}
      <div
        ref={containerRef}
        role="group"
        aria-label="Interface mode segmented control"
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          background: '#F0ECE6',
          border: '1px solid #E8E3DC',
          borderRadius: '9999px',
          padding: '3px',
          boxSizing: 'border-box',
        }}
      >
        {/* Sliding White Pill Indicator */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '3px',
            bottom: '3px',
            left: `${pillStyle.left}px`,
            width: `${pillStyle.width}px`,
            background: '#FFFFFF',
            borderRadius: '9999px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
            transition: 'left 200ms ease-out, width 200ms ease-out',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Option 1: Voice */}
        <button
          ref={voiceBtnRef}
          type="button"
          onClick={() => handleSegmentClick('voice')}
          aria-pressed={activeSegment === 'voice'}
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '9999px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: activeSegment === 'voice' ? 600 : 500,
            color: activeSegment === 'voice' ? '#19161D' : '#575260',
            fontFamily: 'inherit',
            transition: 'color 150ms ease-out',
          }}
          onMouseEnter={(e) => {
            if (activeSegment !== 'voice') e.currentTarget.style.color = '#19161D';
          }}
          onMouseLeave={(e) => {
            if (activeSegment !== 'voice') e.currentTarget.style.color = '#575260';
          }}
        >
          <Mic size={16} strokeWidth={1.5} />
          <span>Voice</span>
        </button>

        {/* Option 2: Screen */}
        <button
          ref={screenBtnRef}
          type="button"
          onClick={() => handleSegmentClick('screen')}
          aria-pressed={activeSegment === 'screen'}
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '9999px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: activeSegment === 'screen' ? 600 : 500,
            color: activeSegment === 'screen' ? '#19161D' : '#575260',
            fontFamily: 'inherit',
            transition: 'color 150ms ease-out',
          }}
          onMouseEnter={(e) => {
            if (activeSegment !== 'screen') e.currentTarget.style.color = '#19161D';
          }}
          onMouseLeave={(e) => {
            if (activeSegment !== 'screen') e.currentTarget.style.color = '#575260';
          }}
        >
          <Monitor size={16} strokeWidth={1.5} />
          <span>Screen</span>
        </button>

        {/* Option 3: Trace */}
        <button
          ref={traceBtnRef}
          type="button"
          onClick={() => handleSegmentClick('trace')}
          aria-pressed={activeSegment === 'trace'}
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '9999px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: activeSegment === 'trace' ? 600 : 500,
            color: activeSegment === 'trace' ? '#19161D' : '#575260',
            fontFamily: 'inherit',
            transition: 'color 150ms ease-out',
          }}
          onMouseEnter={(e) => {
            if (activeSegment !== 'trace') e.currentTarget.style.color = '#19161D';
          }}
          onMouseLeave={(e) => {
            if (activeSegment !== 'trace') e.currentTarget.style.color = '#575260';
          }}
        >
          <Activity size={16} strokeWidth={1.5} />
          <span>Trace</span>
          {traceItems.length > 0 && (
            <span
              style={{
                fontSize: '10px',
                padding: '0 5px',
                borderRadius: '9999px',
                background: '#E8E3DC',
                color: '#575260',
                fontWeight: 600,
              }}
            >
              {traceItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Top Right: Early Access Badge + Plain Gear + Avatar with 1px ring */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        {/* Early Access Small Outline Badge */}
        <div
          style={{
            border: '1px solid #E8E3DC',
            borderRadius: '9999px',
            padding: '3px 9px',
            fontSize: '11px',
            fontWeight: 500,
            color: '#8E8798',
            background: 'transparent',
            userSelect: 'none',
            letterSpacing: '0.01em',
          }}
        >
          Early Access
        </div>

        {/* Plain Gear Icon */}
        <button
          type="button"
          onClick={openSettings}
          aria-label="Settings"
          title="Open Settings"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'transparent',
            border: 'none',
            color: '#575260',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'color 150ms ease-out, background-color 150ms ease-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#19161D';
            e.currentTarget.style.backgroundColor = '#F5F2EE';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#575260';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Settings size={16} strokeWidth={1.5} />
        </button>

        {/* Avatar with 1px Ring */}
        <button
          type="button"
          onClick={openSettings}
          aria-label={`User profile for ${displayName}`}
          title={`Signed in as ${displayName}`}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#F5F2EE',
            border: '1px solid #E8E3DC',
            color: '#575260',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
            transition: 'border-color 150ms ease-out',
            padding: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#C9C3B8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#E8E3DC';
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

export default TopBar;
