import React from 'react';
import { FileText, Calendar, ShoppingBag, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SuggestionChipsProps {
  onSelectPrompt: (promptText: string) => void;
  style?: React.CSSProperties;
}

interface SuggestionCard {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: LucideIcon;
}

const SUGGESTIONS: SuggestionCard[] = [
  {
    id: 'food-delivery-app',
    title: 'Build a food delivery app',
    description: 'Customer auth, restaurant listings, cart, tracking & admin',
    prompt: 'Create a responsive food delivery app with customer authentication, restaurant listings, search, cart, checkout, order tracking, and an admin dashboard.',
    icon: Layers,
  },
  {
    id: 'amazon-shopping',
    title: 'Amazon shopping automation',
    description: 'Price-check products, verify ratings, and automate cart checkout',
    prompt: 'Find the best creatine monohydrate under ₹500 on Amazon and add to cart with live overlay',
    icon: ShoppingBag,
  },
  {
    id: 'summarize-meeting',
    title: 'Summarize last meeting',
    description: 'Extract action items, core decisions, and shared notes from sync',
    prompt: 'Summarize my last meeting',
    icon: FileText,
  },
  {
    id: 'calendar-overview',
    title: 'Calendar overview',
    description: "Review schedule, upcoming commitments, and priorities tomorrow",
    prompt: "What's on my calendar tomorrow?",
    icon: Calendar,
  },
];

export const SuggestionChips: React.FC<SuggestionChipsProps> = ({ onSelectPrompt, style }) => {
  return (
    <div
      role="region"
      aria-label="Starter suggestions"
      className="suggestions-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '12px',
        width: '100%',
        maxWidth: '720px',
        marginTop: '16px',
        ...style,
      }}
    >
      {SUGGESTIONS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectPrompt(item.prompt)}
            className="suggestion-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              textAlign: 'left',
              padding: '14px 16px',
              borderRadius: '12px',
              background: '#FFFFFF',
              border: '1px solid #E8E3DC',
              cursor: 'pointer',
              boxShadow: 'none',
              transition: 'transform 150ms ease-out, border-color 150ms ease-out, background-color 150ms ease-out',
              width: '100%',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#C9C3B8';
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E8E3DC';
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Top-left line icon in muted gray */}
            <div
              style={{
                color: '#8E8798',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-hidden="true"
            >
              <Icon size={16} strokeWidth={1.5} />
            </div>

            {/* Short Title */}
            <span
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#19161D',
                fontFamily: 'inherit',
                lineHeight: 1.35,
                marginBottom: '3px',
              }}
            >
              {item.title}
            </span>

            {/* Muted one-line description */}
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
              {item.description}
            </span>
          </button>
        );
      })}

      <style>{`
        @media (max-width: 640px) {
          .suggestions-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SuggestionChips;
