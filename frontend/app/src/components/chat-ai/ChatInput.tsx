import React, { useRef, useEffect } from 'react';
import { Smile, Mic, ArrowUp, Radio } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: (val: string) => void;
  onOpenVoice: () => void;
  onToggleMic: () => void;
  isListening?: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  onOpenVoice,
  onToggleMic,
  isListening = false,
  disabled = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
  };

  const hasText = value.trim().length > 0;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
        margin: '0 auto',
        position: 'relative',
      }}
    >
      {/* Floating pill-shaped input container with subtle shadow */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#ffffff',
          border: '1px solid #dbe2ea',
          borderRadius: '9999px',
          padding: '8px 12px 8px 16px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
          gap: '8px',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Emoji / avatar icon on left */}
        <button
          type="button"
          aria-label="Add emoji"
          title="Add emoji"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#2563eb')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
        >
          <Smile size={19} />
        </button>

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening to voice...' : "What's in your mind?"}
          disabled={disabled}
          aria-label="What's in your mind?"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '14.5px',
            color: '#0f172a',
            fontFamily: 'inherit',
            resize: 'none',
            lineHeight: '1.4',
            padding: '4px 0',
            maxHeight: '140px',
            overflowY: 'auto',
          }}
        />

        {/* Voice agent mode button */}
        <button
          type="button"
          onClick={onOpenVoice}
          aria-label="Open Voice Agent Mode"
          title="Voice Agent Aurora Orb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 12px',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)',
            border: '1px solid #bfdbfe',
            color: '#2563eb',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 1px 3px rgba(37, 99, 235, 0.1)',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.03)';
            e.currentTarget.style.borderColor = '#93c5fd';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.borderColor = '#bfdbfe';
          }}
        >
          <Radio size={13} />
          <span>Voice</span>
        </button>

        {/* Mic button */}
        <button
          type="button"
          onClick={onToggleMic}
          aria-label={isListening ? 'Stop recording voice' : 'Start voice input'}
          title={isListening ? 'Stop recording voice' : 'Record voice'}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: isListening ? '1px solid #fca5a5' : 'none',
            background: isListening ? '#fee2e2' : 'transparent',
            color: isListening ? '#dc2626' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!isListening) {
              e.currentTarget.style.color = '#0f172a';
              e.currentTarget.style.background = '#f1f5f9';
            }
          }}
          onMouseLeave={(e) => {
            if (!isListening) {
              e.currentTarget.style.color = '#64748b';
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <Mic size={17} />
        </button>

        {/* Round blue send button on the right */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!hasText || disabled}
          aria-label="Send message"
          title="Send message"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: hasText && !disabled ? '#2563eb' : '#f1f5f9',
            border: 'none',
            color: hasText && !disabled ? '#ffffff' : '#94a3b8',
            cursor: hasText && !disabled ? 'pointer' : 'not-allowed',
            opacity: hasText && !disabled ? 1 : 0.65,
            boxShadow: hasText && !disabled ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (hasText && !disabled) {
              e.currentTarget.style.background = '#1d4ed8';
              e.currentTarget.style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (hasText && !disabled) {
              e.currentTarget.style.background = '#2563eb';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        >
          <ArrowUp size={17} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
