import { Check, BookOpen, Sparkles, ShoppingBag, Compass } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { KineticTextReveal } from '@/components/ui/kinetic-text-reveal';

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
      {CHIPS.map((chip, index) => {
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
              borderRadius: '9999px',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#F8FAFC';
              e.currentTarget.style.color = '#0F172A';
              e.currentTarget.style.borderColor = '#CBD5E1';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#FFFFFF';
              e.currentTarget.style.color = '#475569';
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Icon size={14} strokeWidth={2} style={{ color: '#2563EB', opacity: 0.9 }} />
            <KineticTextReveal
              text={chip.label}
              splitBy="characters"
              stagger={0.03}
              delay={0.35 + index * 0.06}
              distance={8}
              className="font-medium"
            />
          </button>
        );
      })}
    </div>
  );
};
