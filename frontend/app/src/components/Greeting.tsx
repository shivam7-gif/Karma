import React from 'react';
import { CONFIG } from '../config';
import { useAppStore } from '../store/appStore';
import { initialListData } from '../data/lists';

interface GreetingProps {
  className?: string;
  style?: React.CSSProperties;
}

export const Greeting: React.FC<GreetingProps> = ({ className = '', style }) => {
  const { user } = useAppStore();
  const userName = user?.name || CONFIG.userName || 'Shiva';

  const hour = new Date().getHours();
  const timeSalutation =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Build subtitle only from real data (e.g. lists/tasks), or fallback to short neutral line
  const nextEventItem = initialListData.customLists.find((item) =>
    item.title.toLowerCase().includes('event')
  );
  const totalLists = initialListData.customLists.length + initialListData.shoppingLists.length;

  const subtitle = nextEventItem
    ? `You have ${totalLists} active lists, including ${nextEventItem.title}.`
    : 'Ready when you are.';

  return (
    <div
      className={`assistant-greeting ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        marginBottom: '26px',
        userSelect: 'none',
        ...style,
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display, 'Instrument Serif', Georgia, serif)",
          fontSize: 'clamp(2.4rem, 5vw, 3.25rem)',
          fontWeight: 400,
          letterSpacing: '-0.025em',
          color: 'var(--text-primary)',
          margin: 0,
          lineHeight: 1.15,
        }}
      >
        {timeSalutation}, {userName}.
      </h1>

      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '15px',
          fontWeight: 400,
          color: 'var(--text-secondary)',
          margin: '8px 0 0 0',
          letterSpacing: '-0.01em',
        }}
      >
        {subtitle}
      </p>
    </div>
  );
};

export default Greeting;
