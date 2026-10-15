import { Check, BookOpen, Sparkles, ShoppingBag, Compass } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SuggestionChipsProps {
  onSelectPrompt: (promptText: string) => void;
  style?: React.CSSProperties;
}

interface ChipItem {
  id: string;
  label: string;
  icon: LucideIcon;
  starterPrompt: string;
}

const CHIPS: ChipItem[] = [
  {
    id: 'plan',
    label: 'Plan',
    icon: Check,
    starterPrompt: 'Plan a 3-day itinerary for our upcoming trip',
  },
  {
    id: 'learn',
    label: 'Learn',
    icon: BookOpen,
    starterPrompt: 'Explain how ambient voice interfaces work in smart homes',
  },
  {
    id: 'create',
    label: 'Create',
    icon: Sparkles,
    starterPrompt: 'Create a calming evening wind-down routine for the house',
  },
  {
    id: 'shop',
    label: 'Shop',
    icon: ShoppingBag,
    starterPrompt: 'What items do I need from Whole Foods this week?',
  },
  {
    id: 'find',
    label: 'Find',
    icon: Compass,
    starterPrompt: 'Find quiet coffee shops with good Wi-Fi nearby',
  },
];

export const SuggestionChips: React.FC<SuggestionChipsProps> = ({ onSelectPrompt, style }) => {
  return (
    <div
      role="region"
      aria-label="Starter suggestion chips"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        marginTop: '18px',
        ...style,
      }}
    >
      {CHIPS.map((chip) => {
        const Icon = chip.icon;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onSelectPrompt(chip.starterPrompt)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              backdropFilter: 'var(--blur-glass)',
              transition: 'all var(--transition-normal)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border-glass)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Icon size={14} strokeWidth={2} style={{ opacity: 0.85 }} />
            <span>{chip.label}</span>
          </button>
        );
      })}
    </div>
  );
};
