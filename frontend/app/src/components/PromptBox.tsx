import React, { useRef, useEffect } from 'react';
import { Paperclip, Mic, ArrowUp, Square } from 'lucide-react';
import { BrandRingIcon } from './BrandLogo';
import { useSpeech } from '../hooks/useSpeech';
import { useAppStore } from '../store/appStore';
import { useChatStream } from '../hooks/useChatStream';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { openVoiceModal, isStreaming } = useAppStore();
  const { stopStream } = useChatStream();

  const { isListening, transcript, stopListening } = useSpeech({
    onTranscript: (spokenText) => {
      onChange(spokenText);
    },
  });

  // Global Cmd/Ctrl+K listener to focus prompt input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // If transcript changes from speech hook, update input
  useEffect(() => {
    if (transcript) {
      onChange(transcript);
    }
  }, [transcript, onChange]);

  // Auto-resize textarea height to accommodate multiline input
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 24), 140);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [value]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = value.trim();
    // Safe prevention of duplicate submissions & empty submissions
    if (!trimmed || disabled || isStreaming) return;
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter creates a newline in multiline mode
        return;
      }
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      openVoiceModal();
    }
  };

  const handleStopClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    stopStream();
  };

  const hasText = value.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className={`prompt-box-container ${isDocked ? 'docked' : ''}`}
      style={{
        width: '100%',
        maxWidth: isDocked ? '820px' : '640px',
        margin: '0 auto',
        position: 'relative',
        transition: 'all var(--transition-fast, 150ms ease)',
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
          border: '1px solid var(--border-glass, #e7e2d8)',
          borderRadius: 'var(--r-lg, 16px)',
          padding: '8px 12px 8px 16px',
          boxShadow: 'var(--shadow-soft, 0 2px 10px rgba(0, 0, 0, 0.04))',
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

        {/* Input Multiline Text Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening
              ? 'Listening…'
              : isStreaming
              ? 'Karma is responding… (Press Esc or click Stop)'
              : 'Ask anything (Enter to send, Shift+Enter for newline)'
          }
          disabled={disabled || isStreaming}
          aria-label="Ask Karma anything"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary, #19161d)',
            fontSize: '15px',
            fontFamily: 'var(--font-sans, inherit)',
            fontWeight: 400,
            letterSpacing: '-0.01em',
            padding: '4px 0',
            resize: 'none',
            lineHeight: '1.45',
            maxHeight: '140px',
            overflowY: value.includes('\n') ? 'auto' : 'hidden',
          }}
        />

        {/* Action icons on right */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginLeft: '8px',
            flexShrink: 0,
          }}
        >
          {/* Attach Button */}
          <button
            type="button"
            onClick={handleAttachClick}
            disabled={disabled || isStreaming}
            aria-label="Attach file"
            title="Attach a file"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--r-sm, 10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #575260)',
              cursor: disabled || isStreaming ? 'not-allowed' : 'pointer',
              opacity: disabled || isStreaming ? 0.4 : 1,
              transition: 'all var(--transition-fast, 150ms ease)',
            }}
            onMouseEnter={(e) => {
              if (!disabled && !isStreaming) {
                e.currentTarget.style.color = 'var(--text-primary, #19161d)';
                e.currentTarget.style.background = 'var(--surface-glass-hover, #f5f2ec)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary, #575260)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Paperclip size={16} />
          </button>

          {/* Mic Button: Talk (idle) / Stop (listening) */}
          <button
            type="button"
            onClick={handleMicClick}
            disabled={disabled || isStreaming}
            aria-label={isListening ? 'Stop listening' : 'Start voice conversation'}
            title={isListening ? 'Stop listening' : 'Talk with Karma voice agent'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 11px',
              borderRadius: 'var(--r-full, 9999px)',
              background: isListening
                ? '#fee2e2'
                : 'var(--accent-soft, rgba(139, 61, 255, 0.08))',
              border: `1px solid ${
                isListening ? '#fca5a5' : 'rgba(139, 61, 255, 0.22)'
              }`,
              color: isListening ? '#dc2626' : 'var(--accent, #8b3dff)',
              fontSize: '12px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: disabled || isStreaming ? 'not-allowed' : 'pointer',
              opacity: disabled || isStreaming ? 0.4 : 1,
              transition: 'all var(--transition-hover, 120ms ease)',
            }}
            onMouseEnter={(e) => {
              if (!isListening && !disabled && !isStreaming) {
                e.currentTarget.style.background = 'var(--accent, #8b3dff)';
                e.currentTarget.style.color = '#ffffff';
              }
            }}
            onMouseLeave={(e) => {
              if (!isListening) {
                e.currentTarget.style.background = 'var(--accent-soft, rgba(139, 61, 255, 0.08))';
                e.currentTarget.style.color = 'var(--accent, #8b3dff)';
              }
            }}
          >
            <Mic size={14} strokeWidth={1.8} />
            <span>{isListening ? 'Stop' : 'Talk'}</span>
          </button>

          {/* Send or Stop Button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStopClick}
              aria-label="Stop generation (Esc)"
              title="Stop generation (Esc)"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--r-sm, 10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#dc2626',
                border: 'none',
                color: '#FFFFFF',
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(220, 38, 38, 0.4)',
                transition: 'all var(--transition-hover, 120ms ease)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'brightness(1.1)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Square size={13} fill="currentColor" strokeWidth={0} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!hasText || disabled}
              aria-label="Send message"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--r-sm, 10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: hasText ? 'var(--accent, #8b3dff)' : 'var(--surface-glass-hover, #f5f2ec)',
                border: 'none',
                color: hasText ? '#FFFFFF' : 'var(--text-muted, #8e8798)',
                cursor: hasText ? 'pointer' : 'not-allowed',
                opacity: hasText ? 1 : 0.65,
                boxShadow: hasText ? '0 1px 4px rgba(139, 61, 255, 0.3)' : 'none',
                transition: 'all var(--transition-hover, 120ms ease)',
              }}
              onMouseEnter={(e) => {
                if (hasText) {
                  e.currentTarget.style.filter = 'brightness(1.08)';
                  e.currentTarget.style.transform = 'scale(1.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (hasText) {
                  e.currentTarget.style.filter = 'none';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              <ArrowUp size={16} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
};
