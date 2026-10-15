import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { MessageBubble } from './MessageBubble';
import { VoiceOrb } from './VoiceOrb';

interface ChatViewProps {
  onSelectElicitationOption: (messageId: string, option: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ onSelectElicitationOption }) => {
  const { messages, deviceMode, isStreaming } = useAppStore();
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const lastAssistantMessage = [...messages].reverse().find((m) => m.sender === 'assistant');

  return (
    <div
      className="chat-view-container"
      role="region"
      aria-label="Conversation Transcript"
      aria-live="polite"
      style={{
        flex: 1,
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: '16px 20px 24px 20px',
      }}
    >
      {/* Voice-only ambient mode: shows the pulsing Voice Orb + active spoken text */}
      {deviceMode === 'voice-only' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
            marginBottom: '16px',
            borderRadius: 'var(--radius-xl)',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-glass)',
            backdropFilter: 'var(--blur-glass)',
          }}
        >
          <VoiceOrb
            isSpeaking={isStreaming}
            size={120}
          />
          <div
            style={{
              marginTop: '16px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            {isStreaming ? 'Echo is speaking...' : 'Voice mode active'}
          </div>
          {lastAssistantMessage && (
            <p
              style={{
                marginTop: '10px',
                fontSize: '16px',
                color: 'var(--text-primary)',
                textAlign: 'center',
                maxWidth: '560px',
                lineHeight: 1.5,
              }}
            >
              "{lastAssistantMessage.text || 'Listening...'}"
            </p>
          )}
        </div>
      )}

      {/* Screen Mode Transcript */}
      {deviceMode === 'screen' && (
        <div style={{ flex: 1 }}>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onSelectElicitationOption={onSelectElicitationOption}
            />
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}
    </div>
  );
};
