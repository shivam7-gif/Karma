import React from 'react';
import { CONFIG } from '../config';
import { useAppStore } from '../store/appStore';
import { initialListData } from '../data/lists';

interface GreetingProps {
  className?: string;
  style?: React.CSSProperties;
}

export const Greeting: React.FC<GreetingProps> = ({ className = '', style }) => {
  const { user, setPanelOpen, setActiveNav } = useAppStore();
  const userName = user?.name || CONFIG.userName || 'Shiva';

  const hour = new Date().getHours();
  const timeSalutation =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const totalLists = initialListData.customLists.length + initialListData.shoppingLists.length;
  const nextEventItem = initialListData.customLists.find((item) =>
    item.title.toLowerCase().includes('event')
  ) || { title: 'Next Event Checklist' };

  const handleOpenLists = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveNav('lists');
    setPanelOpen(true);
  };

  return (
    <div
      className={`assistant-greeting ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        marginBottom: '32px',
        userSelect: 'none',
        ...style,
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display, 'Instrument Serif', Georgia, serif)",
          fontSize: 'clamp(2.5rem, 4.2vw, 3.5rem)',
          fontWeight: 400,
          letterSpacing: '-0.01em',
          color: 'var(--text-primary, #19161D)',
          margin: 0,
          lineHeight: 1.15,
        }}
      >
        {timeSalutation}, {userName}.
      </h1>

      {/* Interactive subtext with underlined link and small dot-separated chip */}
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '14.5px',
          fontWeight: 400,
          color: 'var(--text-secondary, #575260)',
          marginTop: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        <span>You have</span>
        <button
          type="button"
          onClick={handleOpenLists}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            font: 'inherit',
            fontWeight: 500,
            color: 'var(--text-primary, #19161D)',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            textDecorationColor: '#C9C3B8',
            cursor: 'pointer',
            transition: 'color 150ms ease-out, text-decoration-color 150ms ease-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#7C3AED';
            e.currentTarget.style.textDecorationColor = '#7C3AED';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-primary, #19161D)';
            e.currentTarget.style.textDecorationColor = '#C9C3B8';
          }}
          aria-label="Open 9 active lists"
        >
          {totalLists} active lists
        </button>
        <span>including</span>
        <button
          type="button"
          onClick={handleOpenLists}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 9px',
            borderRadius: '9999px',
            background: '#F5F2EE',
            border: '1px solid #E8E3DC',
            fontSize: '12px',
            fontWeight: 500,
            color: '#575260',
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'border-color 150ms ease-out, background-color 150ms ease-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#C9C3B8';
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.color = '#19161D';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#E8E3DC';
            e.currentTarget.style.backgroundColor = '#F5F2EE';
            e.currentTarget.style.color = '#575260';
          }}
          title="Open Next Event Checklist"
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#8E8798',
            }}
          />
          <span>{nextEventItem.title}</span>
        </button>
      </div>
    </div>
  );
};

export default Greeting;
