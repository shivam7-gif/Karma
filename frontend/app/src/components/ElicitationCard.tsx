import React from 'react';
import { HelpCircle, CheckCircle2 } from 'lucide-react';

interface ElicitationCardProps {
  question: string;
  options?: string[];
  answered?: string;
  onSelectOption: (option: string) => void;
}

export const ElicitationCard: React.FC<ElicitationCardProps> = ({
  question,
  options = [],
  answered,
  onSelectOption,
}) => {
  return (
    <div
      style={{
        marginTop: '12px',
        padding: '16px',
        borderRadius: 'var(--radius-lg)',
        background: 'rgba(76, 141, 255, 0.08)',
        border: '1px solid rgba(76, 141, 255, 0.25)',
        backdropFilter: 'var(--blur-glass)',
        maxWidth: '520px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          marginBottom: options.length > 0 ? '14px' : '0',
        }}
      >
        <HelpCircle size={18} style={{ color: 'var(--accent-blue)', marginTop: '2px', flexShrink: 0 }} />
        <span
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
          }}
        >
          {question}
        </span>
      </div>

      {options.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          {options.map((option) => {
            const isSelected = answered === option;
            return (
              <button
                key={option}
                type="button"
                disabled={Boolean(answered)}
                onClick={() => onSelectOption(option)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-full)',
                  background: isSelected
                    ? 'var(--accent-blue)'
                    : 'rgba(255, 255, 255, 0.06)',
                  border: isSelected
                    ? '1px solid var(--accent-blue)'
                    : '1px solid var(--border-glass-light)',
                  color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: answered ? 'default' : 'pointer',
                  opacity: answered && !isSelected ? 0.5 : 1,
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  if (!answered) {
                    e.currentTarget.style.background = 'rgba(76, 141, 255, 0.2)';
                    e.currentTarget.style.borderColor = 'var(--accent-blue)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!answered && !isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.borderColor = 'var(--border-glass-light)';
                  }
                }}
              >
                {isSelected && <CheckCircle2 size={13} />}
                <span>{option}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
