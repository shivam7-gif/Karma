import React from 'react';
import type { Message } from '../api/types';
import { BrandRingIcon } from './BrandLogo';
import { ElicitationCard } from './ElicitationCard';
import { CheckSquare } from 'lucide-react';
import { useAppStore } from '../store/appStore';

interface MessageBubbleProps {
  message: Message;
  onSelectElicitationOption?: (messageId: string, option: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onSelectElicitationOption,
}) => {
  const { deviceMode } = useAppStore();
  const isUser = message.sender === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '20px',
        width: '100%',
        maxWidth: '720px',
        margin: '0 auto 20px auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
          flexDirection: isUser ? 'row-reverse' : 'row',
          maxWidth: '100%',
        }}
      >
        {/* Avatar indicator */}
        {!isUser && (
          <div
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '4px',
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <BrandRingIcon size={24} />
          </div>
        )}

        {/* Bubble Box */}
        <div
          style={{
            background: isUser
              ? 'rgba(76, 141, 255, 0.22)'
              : 'rgba(255, 255, 255, 0.05)',
            border: isUser
              ? '1px solid rgba(76, 141, 255, 0.35)'
              : '1px solid var(--border-glass)',
            backdropFilter: 'var(--blur-glass)',
            padding: '12px 18px',
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            color: 'var(--text-primary)',
            fontSize: '15px',
            lineHeight: 1.5,
            boxShadow: 'var(--shadow-glass)',
            wordBreak: 'break-word',
          }}
        >
          {message.text}
        </div>
      </div>

      {/* Screen Mode: Rich Cards (inline) */}
      {!isUser && deviceMode === 'screen' && message.richCard && (
        <div
          style={{
            marginLeft: '40px',
            marginTop: '12px',
            padding: '16px',
            borderRadius: 'var(--radius-lg)',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-glass)',
            width: 'calc(100% - 40px)',
            maxWidth: '480px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <CheckSquare size={16} style={{ color: 'var(--accent-blue)' }} />
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {message.richCard.title}
            </h4>
          </div>
          {message.richCard.details && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              {message.richCard.details}
            </p>
          )}
          {message.richCard.items && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {message.richCard.items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                  {item.count !== undefined && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {item.count} items
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Elicitation Follow-Up Card */}
      {!isUser && message.elicitation && (
        <div style={{ marginLeft: '40px' }}>
          <ElicitationCard
            question={message.elicitation.question}
            options={message.elicitation.options}
            answered={message.elicitation.answered}
            onSelectOption={(option) => {
              if (onSelectElicitationOption) {
                onSelectElicitationOption(message.id, option);
              }
            }}
          />
        </div>
      )}
    </div>
  );
};
