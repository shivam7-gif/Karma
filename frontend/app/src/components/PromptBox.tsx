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
          background: '#FFFFFF',
          border: '1px solid #CBD5E1',
          borderRadius: '9999px',
          padding: '8px 10px 8px 16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
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
            color: '#0F172A',
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
              color: '#64748B',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#0F172A';
              e.currentTarget.style.background = '#F1F5F9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#64748B';
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
              background: isListening ? '#FEE2E2' : 'transparent',
              border: isListening ? '1px solid #FCA5A5' : 'none',
              color: isListening ? '#DC2626' : '#64748B',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              animation: isListening ? 'pulse 1.5s infinite' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isListening) {
                e.currentTarget.style.color = '#0F172A';
                e.currentTarget.style.background = '#F1F5F9';
              }
            }}
            onMouseLeave={(e) => {
              if (!isListening) {
                e.currentTarget.style.color = '#64748B';
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
              background: hasText ? '#2563EB' : '#F1F5F9',
              border: 'none',
              color: hasText ? '#FFFFFF' : '#94A3B8',
              cursor: hasText ? 'pointer' : 'not-allowed',
              opacity: hasText ? 1 : 0.6,
              boxShadow: hasText ? '0 1px 3px rgba(37, 99, 235, 0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (hasText) {
                e.currentTarget.style.background = '#1D4ED8';
                e.currentTarget.style.transform = 'scale(1.04)';
              }
            }}
            onMouseLeave={(e) => {
              if (hasText) {
                e.currentTarget.style.background = '#2563EB';
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
