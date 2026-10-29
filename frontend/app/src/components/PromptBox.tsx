import React, { useRef, useEffect, useState } from 'react';
import { Paperclip, Mic, ArrowUp, Square, ShoppingBag, Code2 } from 'lucide-react';
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
  const [isFocused, setIsFocused] = useState(false);
  const { openVoiceModal, isStreaming, agentLifecycle, appBuilderProvider, setAppBuilderProvider } = useAppStore();
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

  // Update input if transcript arrives
  useEffect(() => {
    if (transcript) {
      onChange(transcript);
    }
  }, [transcript, onChange]);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 26), 160);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [value]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming) return;

    let finalPrompt = trimmed;
    if (
      appBuilderProvider !== 'auto' &&
      /\b(app|application|platform|dashboard|system|website|create|build|scaffold)\b/i.test(trimmed) &&
      !trimmed.toLowerCase().includes('manus') &&
      !trimmed.toLowerCase().includes('replit')
    ) {
      finalPrompt = `${trimmed} (using ${appBuilderProvider})`;
    }

    onSubmit(finalPrompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
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

  const handleAmazonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled || isStreaming) return;
    const trimmed = value.trim();
    if (!trimmed) {
      onSubmit('Find the best creatine monohydrate under ₹500 on Amazon and add to cart with live overlay');
    } else if (trimmed.toLowerCase().includes('amazon')) {
      onSubmit(trimmed);
    } else {
      onSubmit(`Find ${trimmed} on Amazon under ₹1000 and add to cart with live overlay`);
    }
  };

  const hasText = value.trim().length > 0;
  const isScreenControlActive =
    isStreaming &&
    (agentLifecycle?.tool === 'shop_amazon' || agentLifecycle?.status === 'controlling_screen');
  const isAmazonActive = isScreenControlActive || value.toLowerCase().includes('amazon');

  return (
    <form
      onSubmit={handleSubmit}
      className={`prompt-box-container ${isDocked ? 'docked' : ''}`}
      style={{
        width: '100%',
        maxWidth: '720px',
        margin: '0 auto',
        position: 'relative',
        ...style,
      }}
    >
      {/* Live Playwright & Screen Overlay status banner if active */}
      {isScreenControlActive && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            marginBottom: '8px',
            borderRadius: '8px',
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            color: '#92400E',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#F59E0B',
            }}
          />
          <span style={{ fontWeight: 600 }}>Playwright & Screen Overlay:</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {agentLifecycle?.message || 'Controlling screen on Amazon...'}
          </span>
          <span style={{ fontSize: '11px', color: '#B45309' }}>Esc / Stop</span>
        </div>
      )}

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

      {/* Two-row command input card */}
      <div
        style={{
          width: '100%',
          background: '#FFFFFF',
          border: `1px solid ${isFocused ? '#7C3AED' : '#E8E3DC'}`,
          borderRadius: '16px',
          padding: '16px',
          boxShadow: isFocused
            ? '0 0 0 3px rgba(124, 58, 237, 0.12), 0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px -8px rgba(0, 0, 0, 0.08)'
            : '0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px -8px rgba(0, 0, 0, 0.08)',
          transition: 'border-color 200ms ease-out, box-shadow 200ms ease-out',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Row 1: Auto-growing textarea only */}
        <div style={{ width: '100%' }}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={
              isListening
                ? 'Listening…'
                : isStreaming
                ? 'Karma is responding… (Press Esc or click Stop)'
                : 'Ask Karma anything'
            }
            disabled={disabled || isStreaming}
            aria-label="Ask Karma anything"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#19161D',
              fontSize: '15px',
              fontFamily: 'inherit',
              fontWeight: 400,
              padding: 0,
              resize: 'none',
              lineHeight: 1.5,
              minHeight: '26px',
              maxHeight: '160px',
              overflowY: value.includes('\n') ? 'auto' : 'hidden',
            }}
          />
        </div>

        {/* Row 2: Toolbar separated only by spacing */}
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          {/* Left Side: Attach button + Quiet Chips */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
            }}
          >
            {/* Attach Icon Button */}
            <button
              type="button"
              onClick={handleAttachClick}
              disabled={disabled || isStreaming}
              aria-label="Attach file"
              title="Attach a file"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: '#575260',
                cursor: disabled || isStreaming ? 'not-allowed' : 'pointer',
                opacity: disabled || isStreaming ? 0.4 : 1,
                transition: 'all 150ms ease-out',
              }}
              onMouseEnter={(e) => {
                if (!disabled && !isStreaming) {
                  e.currentTarget.style.color = '#19161D';
                  e.currentTarget.style.background = '#F5F2EE';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#575260';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Paperclip size={16} strokeWidth={1.5} />
            </button>

            {/* Voice Quiet Chip */}
            <button
              type="button"
              onClick={handleMicClick}
              disabled={disabled || isStreaming}
              aria-label={isListening ? 'Stop listening' : 'Start voice conversation'}
              title={isListening ? 'Stop listening' : 'Talk with Karma voice agent'}
              style={{
                height: '28px',
                padding: '0 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                borderRadius: '8px',
                background: '#F5F2EE',
                border: '1px solid #E8E3DC',
                color: '#575260',
                fontSize: '12px',
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: disabled || isStreaming ? 'not-allowed' : 'pointer',
                opacity: disabled || isStreaming ? 0.4 : 1,
                transition: 'all 150ms ease-out',
              }}
              onMouseEnter={(e) => {
                if (!disabled && !isStreaming) {
                  e.currentTarget.style.color = '#19161D';
                  e.currentTarget.style.borderColor = '#D8D2C7';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#575260';
                e.currentTarget.style.borderColor = '#E8E3DC';
              }}
            >
              <Mic size={16} strokeWidth={1.5} />
              <span>{isListening ? 'Stop' : 'Voice'}</span>
            </button>

            {/* Amazon Quiet Chip (shows amber dot only when active) */}
            <button
              type="button"
              onClick={handleAmazonClick}
              disabled={disabled || isStreaming}
              aria-label="Automate Amazon Shopping"
              title="Automate Amazon Shopping (MCP + Playwright + Screen Overlay)"
              style={{
                height: '28px',
                padding: '0 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                borderRadius: '8px',
                background: '#F5F2EE',
                border: '1px solid #E8E3DC',
                color: '#575260',
                fontSize: '12px',
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: disabled || isStreaming ? 'not-allowed' : 'pointer',
                opacity: disabled || isStreaming ? 0.4 : 1,
                transition: 'all 150ms ease-out',
              }}
              onMouseEnter={(e) => {
                if (!disabled && !isStreaming) {
                  e.currentTarget.style.color = '#19161D';
                  e.currentTarget.style.borderColor = '#D8D2C7';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#575260';
                e.currentTarget.style.borderColor = '#E8E3DC';
              }}
            >
              <ShoppingBag size={16} strokeWidth={1.5} />
              <span>Amazon</span>
              {isAmazonActive && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#F59E0B',
                    marginLeft: '2px',
                  }}
                  title="Amazon automation active"
                />
              )}
            </button>

            {/* Builder: Auto Quiet Chip */}
            <button
              type="button"
              onClick={() => {
                const next = appBuilderProvider === 'auto' ? 'manus' : appBuilderProvider === 'manus' ? 'replit' : 'auto';
                setAppBuilderProvider(next);
              }}
              disabled={disabled || isStreaming}
              aria-label={`Builder provider: ${appBuilderProvider} (click to toggle)`}
              title={`External App Builder: ${appBuilderProvider.toUpperCase()} (Click to toggle: Auto -> Manus -> Replit)`}
              style={{
                height: '28px',
                padding: '0 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                borderRadius: '8px',
                background: '#F5F2EE',
                border: '1px solid #E8E3DC',
                color: '#575260',
                fontSize: '12px',
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: disabled || isStreaming ? 'not-allowed' : 'pointer',
                opacity: disabled || isStreaming ? 0.4 : 1,
                transition: 'all 150ms ease-out',
              }}
              onMouseEnter={(e) => {
                if (!disabled && !isStreaming) {
                  e.currentTarget.style.color = '#19161D';
                  e.currentTarget.style.borderColor = '#D8D2C7';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#575260';
                e.currentTarget.style.borderColor = '#E8E3DC';
              }}
            >
              <Code2 size={16} strokeWidth={1.5} />
              <span>Builder: {appBuilderProvider === 'auto' ? 'Auto' : appBuilderProvider === 'manus' ? 'Manus' : 'Replit'}</span>
            </button>
          </div>

          {/* Right Side: Keypress Hint Label (focus only) + 32px Circle Send Button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexShrink: 0,
            }}
          >
            {/* Enter/Shift+Enter Hint Label, visible only on focus */}
            <span
              style={{
                fontSize: '11px',
                color: '#8E8798',
                userSelect: 'none',
                opacity: isFocused ? 1 : 0,
                pointerEvents: 'none',
                transition: 'opacity 150ms ease-out',
                whiteSpace: 'nowrap',
              }}
            >
              Enter to send, Shift+Enter for newline
            </span>

            {/* 32px Circle Send or Stop Button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStopClick}
                aria-label="Stop generation (Esc)"
                title="Stop generation (Esc)"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#19161D',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'background 150ms ease-out',
                }}
              >
                <Square size={12} fill="currentColor" strokeWidth={0} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!hasText || disabled}
                aria-label="Send message"
                title={hasText ? 'Send message' : 'Type a prompt to send'}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: hasText ? '#7C3AED' : '#F0ECE6',
                  border: 'none',
                  color: hasText ? '#FFFFFF' : '#8E8798',
                  cursor: hasText ? 'pointer' : 'not-allowed',
                  transition: 'background 150ms ease-out, color 150ms ease-out',
                }}
              >
                <ArrowUp size={16} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
};
