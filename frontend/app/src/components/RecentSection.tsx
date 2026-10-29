import React from 'react';
import { MessageSquare, ListTodo, Calendar } from 'lucide-react';
import { useAppStore } from '../store/appStore';

interface RecentSectionProps {
  style?: React.CSSProperties;
}

export const RecentSection: React.FC<RecentSectionProps> = ({ style }) => {
  const { setPanelOpen, setActiveNav, setInputValue } = useAppStore();

  const handleListClick = () => {
    setActiveNav('lists');
    setPanelOpen(true);
  };

  const handleChatClick = () => {
    setInputValue('Continue working on Storefront UI wireframes');
  };

  const handleCalendarClick = () => {
    setInputValue("Show details for tomorrow's Product Roadmap Sync");
  };

  return (
    <div
      role="region"
      aria-label="Pick up where you left off"
      style={{
        width: '100%',
        maxWidth: '720px',
        marginTop: '28px',
        textAlign: 'left',
        ...style,
      }}
    >
      {/* Small uppercase section label */}
      <div
        style={{
          fontSize: '11px',
          letterSpacing: '0.08em',
          fontWeight: 600,
          color: '#8E8798',
          textTransform: 'uppercase',
          marginBottom: '10px',
          userSelect: 'none',
        }}
      >
        Pick up where you left off
      </div>

      {/* 3 Horizontal Cards Grid */}
      <div
        className="recent-cards-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '12px',
          width: '100%',
        }}
      >
        {/* Card 1: Recent Chat */}
        <button
          type="button"
          onClick={handleChatClick}
          className="recent-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
            padding: '14px 16px',
            borderRadius: '12px',
            background: '#FFFFFF',
            border: '1px solid #E8E3DC',
            boxShadow: 'none',
            cursor: 'pointer',
            transition: 'transform 150ms ease-out, border-color 150ms ease-out',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#C9C3B8';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#E8E3DC';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          aria-label="Resume recent chat: Storefront UI wireframes"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              marginBottom: '10px',
            }}
          >
            <div style={{ color: '#8E8798', display: 'flex', alignItems: 'center' }} aria-hidden="true">
              <MessageSquare size={16} strokeWidth={1.5} />
            </div>
            <span style={{ fontSize: '11px', color: '#8E8798' }}>Yesterday, 4:15 PM</span>
          </div>

          <span
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: '#19161D',
              fontFamily: 'inherit',
              lineHeight: 1.35,
              marginBottom: '3px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: '100%',
            }}
          >
            Storefront UI wireframes
          </span>

          <span
            style={{
              fontSize: '12px',
              color: '#8E8798',
              fontFamily: 'inherit',
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: '100%',
            }}
          >
            Generated 3 design variants
          </span>
        </button>

        {/* Card 2: Active List with Progress Bar */}
        <button
          type="button"
          onClick={handleListClick}
          className="recent-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
            padding: '14px 16px',
            borderRadius: '12px',
            background: '#FFFFFF',
            border: '1px solid #E8E3DC',
            boxShadow: 'none',
            cursor: 'pointer',
            transition: 'transform 150ms ease-out, border-color 150ms ease-out',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#C9C3B8';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#E8E3DC';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          aria-label="View active list: Next Event Checklist, 5 of 8 completed"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              marginBottom: '10px',
            }}
          >
            <div style={{ color: '#8E8798', display: 'flex', alignItems: 'center' }} aria-hidden="true">
              <ListTodo size={16} strokeWidth={1.5} />
            </div>
            <span style={{ fontSize: '11px', color: '#8E8798' }}>5 of 8 completed</span>
          </div>

          <span
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: '#19161D',
              fontFamily: 'inherit',
              lineHeight: 1.35,
              marginBottom: '6px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: '100%',
            }}
          >
            Next Event Checklist
          </span>

          {/* Clean progress bar */}
          <div
            style={{
              width: '100%',
              height: '4px',
              background: '#F0ECE6',
              borderRadius: '2px',
              overflow: 'hidden',
              marginTop: '4px',
            }}
            role="progressbar"
            aria-valuenow={62}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              style={{
                width: '62.5%',
                height: '100%',
                background: '#7C3AED',
                borderRadius: '2px',
              }}
            />
          </div>
        </button>

        {/* Card 3: Upcoming Calendar Event */}
        <button
          type="button"
          onClick={handleCalendarClick}
          className="recent-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
            padding: '14px 16px',
            borderRadius: '12px',
            background: '#FFFFFF',
            border: '1px solid #E8E3DC',
            boxShadow: 'none',
            cursor: 'pointer',
            transition: 'transform 150ms ease-out, border-color 150ms ease-out',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#C9C3B8';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#E8E3DC';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          aria-label="View calendar event: Product Roadmap Sync tomorrow at 10:00 AM"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              marginBottom: '10px',
            }}
          >
            <div style={{ color: '#8E8798', display: 'flex', alignItems: 'center' }} aria-hidden="true">
              <Calendar size={16} strokeWidth={1.5} />
            </div>
            <span style={{ fontSize: '11px', color: '#8E8798' }}>Tomorrow, 10:00 AM</span>
          </div>

          <span
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: '#19161D',
              fontFamily: 'inherit',
              lineHeight: 1.35,
              marginBottom: '3px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: '100%',
            }}
          >
            Product Roadmap Sync
          </span>

          <span
            style={{
              fontSize: '12px',
              color: '#8E8798',
              fontFamily: 'inherit',
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: '100%',
            }}
          >
            Design system & rollout
          </span>
        </button>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .recent-cards-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default RecentSection;
