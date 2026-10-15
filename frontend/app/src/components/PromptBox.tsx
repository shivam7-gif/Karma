import React, { useRef, useEffect } from 'react';
import { Paperclip, Mic, ArrowUp } from 'lucide-react';
import { BrandRingIcon } from './BrandLogo';
import { useSpeech } from '../hooks/useSpeech';

interface PromptBoxProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: (val: string) => void;
  disabled?: boolean;
  isDocked?: boolean;
  style?: React.CSSProperties;
}

export const PromptBox: React.FC<PromptBoxProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  isDocked = false,
  style,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isListening, toggleListening, transcript } = useSpeech({
    onTranscript: (spokenText) => {
      onChange(spokenText);
    },
  });

  // If transcript changes from speech hook, update input
  useEffect(() => {
    if (transcript) {
      onChange(transcript);
    }
  }, [transcript, onChange]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const hasText = value.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className={`prompt-box-container ${isDocked ? 'docked' : ''}`}
      style={{
        width: '100%',
        maxWidth: '640px',
        margin: '0 auto',
        position: 'relative',
        transition: 'all var(--transition-normal)',
        ...style,
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        aria-hidden="true"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.[0]) {
            const fileName = e.target.files[0].name;
            onChange(`${value ? value + ' ' : ''}[Attached: ${fileName}]`);
          }
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'var(--blur-glass)',
          WebkitBackdropFilter: 'var(--blur-glass)',
          border: '1px solid var(--border-glass-light)',
          borderRadius: 'var(--radius-full)',
          padding: '8px 10px 8px 16px',
          boxShadow: 'var(--shadow-input)',
          transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
        }}
        onFocus={() => {
          // Subtle focus glow
        }}
      >
        {/* Left: Brand ring icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '12px',
            flexShrink: 0,
            opacity: 0.9,
          }}
          aria-hidden="true"
        >
          <BrandRingIcon size={22} />
        </div>

        {/* Input Text Box */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening...' : 'Ask anything'}
          disabled={disabled}
          aria-label="Ask assistant anything"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '15px',
            fontFamily: 'inherit',
            fontWeight: 400,
            letterSpacing: '-0.01em',
            padding: '6px 0',
          }}
        />

        {/* Action icons on right */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px',
            flexShrink: 0,
          }}
        >
          {/* Attach Button */}
          <button
            type="button"
            onClick={handleAttachClick}
            aria-label="Attach file"
            title="Attach a file"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Paperclip size={16} />
          </button>

          {/* Mic Button */}
          <button
            type="button"
            onClick={toggleListening}
            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
            title={isListening ? 'Stop recording' : 'Voice input (Web Speech)'}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              border: isListening ? '1px solid rgba(239, 68, 68, 0.5)' : 'none',
              color: isListening ? '#EF4444' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              animation: isListening ? 'pulse 1.5s infinite' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isListening) {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isListening) {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <Mic size={16} />
          </button>

          {/* Send Arrow Button */}
          <button
            type="submit"
            disabled={!hasText || disabled}
            aria-label="Send message"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: hasText ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: hasText ? '#FFFFFF' : 'rgba(255, 255, 255, 0.25)',
              cursor: hasText ? 'pointer' : 'not-allowed',
              opacity: hasText ? 1 : 0.45,
              boxShadow: hasText ? '0 2px 8px rgba(76, 141, 255, 0.4)' : 'none',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              if (hasText) {
                e.currentTarget.style.background = 'var(--text-accent-hover)';
                e.currentTarget.style.transform = 'scale(1.04)';
              }
            }}
            onMouseLeave={(e) => {
              if (hasText) {
                e.currentTarget.style.background = 'var(--accent-blue)';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </form>
  );
};
