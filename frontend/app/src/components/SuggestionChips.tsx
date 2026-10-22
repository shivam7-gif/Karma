import React from 'react';
import { FileText, Calendar, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SuggestionChipsProps {
  onSelectPrompt: (promptText: string) => void;
  style?: React.CSSProperties;
}

interface ProductSuggestion {
  id: string;
  label: string;
  icon: LucideIcon;
}

const PRODUCT_SUGGESTIONS: ProductSuggestion[] = [
  {
    id: 'meeting',
    label: 'Summarize my last meeting',
    icon: FileText,
  },
  {
    id: 'calendar',
    label: "What's on my calendar tomorrow?",
    icon: Calendar,
  },
  {
    id: 'document',
    label: 'Find that document about…',
    icon: Search,
  },
];

export const SuggestionChips: React.FC<SuggestionChipsProps> = ({ onSelectPrompt, style }) => {
  return (
    <div
      role="region"
      aria-label="Starter suggestions"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginTop: '16px',
        ...style,
      }}
    >
      {PRODUCT_SUGGESTIONS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectPrompt(item.label)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 14px',
              borderRadius: 'var(--r-full, 9999px)',
              background: '#ffffff',
              border: '1px solid var(--border-glass, #e7e2d8)',
              color: 'var(--text-secondary, #575260)',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-soft, 0 1px 3px rgba(0, 0, 0, 0.03))',
              transition: 'all var(--transition-hover, 120ms ease)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary, #19161d)';
              e.currentTarget.style.borderColor = 'var(--accent, #8b3dff)';
              e.currentTarget.style.background = 'var(--accent-soft, rgba(139, 61, 255, 0.05))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary, #575260)';
              e.currentTarget.style.borderColor = 'var(--border-glass, #e7e2d8)';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <Icon size={13} strokeWidth={1.8} style={{ color: 'var(--accent, #8b3dff)' }} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default SuggestionChips;
