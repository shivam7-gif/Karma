import React, { useRef, useEffect } from 'react';
import { Paperclip, Mic, ArrowUp, Square, ShoppingBag, Code2 } from 'lucide-react';
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
      {/* Live Playwright & Overlay Screen Control Active Banner */}
      {isScreenControlActive && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 12px',
            marginBottom: '8px',
            borderRadius: '6px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#92400e',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#f59e0b',
            }}
          />
          <span style={{ fontWeight: 600 }}>Playwright & Screen Overlay Active:</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {agentLifecycle?.message || 'Controlling screen on Amazon...'}
          </span>
          <span style={{ fontSize: '11px', color: '#b45309' }}>Esc / Stop</span>
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

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          background: '#FFFFFF',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '8px 12px 8px 14px',
          boxShadow: 'none',
          transition: 'border-color 0.15s ease',
        }}
      >
        {/* Left: Brand ring icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '10px',
            flexShrink: 0,
            color: '#111111',
          }}
          aria-hidden="true"
        >
          <BrandRingIcon size={20} />
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
              : 'Ask Karma anything (Enter to send, Shift+Enter for newline)'
          }
          disabled={disabled || isStreaming}
          aria-label="Ask Karma anything"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#111111',
            fontSize: '14.5px',
            fontFamily: 'inherit',
            fontWeight: 400,
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
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: '#6b7280',
              cursor: disabled || isStreaming ? 'not-allowed' : 'pointer',
              opacity: disabled || isStreaming ? 0.4 : 1,
            }}
            onMouseEnter={(e) => {
              if (!disabled && !isStreaming) {
                e.currentTarget.style.color = '#111111';
                e.currentTarget.style.background = '#f3f4f6';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#6b7280';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Paperclip size={15} />
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
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '6px',
              background: isListening ? '#f3f4f6' : '#f9fafb',
              border: '1px solid #e5e7eb',
              color: '#111111',
              fontSize: '12px',
              fontWeight: 500,
              cursor: disabled || isStreaming ? 'not-allowed' : 'pointer',
              opacity: disabled || isStreaming ? 0.4 : 1,
            }}
          >
            <Mic size={13} strokeWidth={1.8} />
            <span>{isListening ? 'Stop' : 'Voice'}</span>
          </button>

          {/* Amazon Automation Trigger Button */}
          <button
            type="button"
            onClick={handleAmazonClick}
            disabled={disabled || isStreaming}
            aria-label="Automate Amazon Shopping with Playwright & Screen Overlay"
            title="Automate Amazon Shopping (MCP + Playwright + Screen Overlay)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 9px',
              borderRadius: '6px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
              fontSize: '12px',
              fontWeight: 600,
              cursor: disabled || isStreaming ? 'not-allowed' : 'pointer',
              opacity: disabled || isStreaming ? 0.4 : 1,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!disabled && !isStreaming) {
                e.currentTarget.style.background = '#fef3c7';
                e.currentTarget.style.borderColor = '#f59e0b';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fffbeb';
              e.currentTarget.style.borderColor = '#fde68a';
            }}
          >
            <ShoppingBag size={13} strokeWidth={2} />
            <span>Amazon</span>
          </button>

          {/* External App Builder Provider Toggle */}
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 9px',
              borderRadius: '6px',
              background: appBuilderProvider === 'auto' ? '#f3f4f6' : appBuilderProvider === 'manus' ? '#ecfdf5' : '#eff6ff',
              border: `1px solid ${appBuilderProvider === 'auto' ? '#e5e7eb' : appBuilderProvider === 'manus' ? '#a7f3d0' : '#bfdbfe'}`,
              color: appBuilderProvider === 'auto' ? '#4b5563' : appBuilderProvider === 'manus' ? '#047857' : '#1d4ed8',
              fontSize: '12px',
              fontWeight: 600,
              cursor: disabled || isStreaming ? 'not-allowed' : 'pointer',
              opacity: disabled || isStreaming ? 0.4 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            <Code2 size={13} strokeWidth={2} />
            <span>Builder: {appBuilderProvider === 'auto' ? 'Auto' : appBuilderProvider === 'manus' ? 'Manus' : 'Replit'}</span>
          </button>

          {/* Simple Black Send or Stop Button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStopClick}
              aria-label="Stop generation (Esc)"
              title="Stop generation (Esc)"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#111111',
                border: 'none',
                color: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              <Square size={12} fill="currentColor" strokeWidth={0} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!hasText || disabled}
              aria-label="Send message"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: hasText ? '#111111' : '#f3f4f6',
                border: 'none',
                color: hasText ? '#FFFFFF' : '#9ca3af',
                cursor: hasText ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s ease',
              }}
            >
              <ArrowUp size={15} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
};
