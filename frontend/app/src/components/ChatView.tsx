import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { MessageBubble } from './MessageBubble';
import AuroraOrb from './chat-ai/AuroraOrb';
import { useAudioLevel } from '../hooks/useAudioLevel';
import { useChatStream } from '../hooks/useChatStream';

interface ChatViewProps {
  onSelectElicitationOption: (messageId: string, option: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ onSelectElicitationOption }) => {
  const { messages, deviceMode, isStreaming, openVoiceModal } = useAppStore();
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const { audioLevelRef, triggerWordPulse } = useAudioLevel();
  const { handleSendMessage } = useChatStream();

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (isStreaming) {
      triggerWordPulse(0.9, 300);
    }
  }, [isStreaming, triggerWordPulse]);

  const lastAssistantMessage = [...messages].reverse().find((m) => m.sender === 'assistant');
  const lastUserMessage = [...messages].reverse().find((m) => m.sender === 'user');
  const voiceState = isStreaming ? 'speaking' : 'idle';

  const handleRegenerate = () => {
    if (lastUserMessage) {
      handleSendMessage(lastUserMessage.text);
    }
  };

  return (
    <div
      className="chat-view-container"
      role="region"
      aria-label="Conversation Transcript"
      aria-live="polite"
      style={{
        flex: 1,
        width: '100%',
        maxWidth: '920px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: '16px 20px 24px 20px',
      }}
    >
      {/* Voice-only ambient mode: shows the animated 220px SoftAurora Orb reacting to speech */}
      {deviceMode === 'voice-only' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 16px',
            marginBottom: '16px',
            borderRadius: '24px',
            background: 'rgba(255, 255, 255, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div style={{ margin: '8px 0 16px 0' }}>
            <AuroraOrb
              size={220}
              state={voiceState}
              audioLevelRef={audioLevelRef}
              onClick={openVoiceModal}
            />
          </div>
          <div
            style={{
              fontSize: '13px',
              color: isStreaming ? '#a855f7' : '#64748b',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {isStreaming ? 'Echo is speaking...' : 'Voice mode active (click orb to expand)'}
          </div>
          {lastAssistantMessage && (
            <p
              style={{
                marginTop: '12px',
                fontSize: '15px',
                color: '#1e293b',
                textAlign: 'center',
                maxWidth: '560px',
                lineHeight: 1.6,
                fontWeight: 500,
              }}
            >
              "{lastAssistantMessage.text || 'Listening...'}"
            </p>
          )}
        </div>
      )}

      {/* Screen Mode Transcript */}
      {deviceMode === 'screen' && (
        <div style={{ flex: 1, width: '100%' }}>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onSelectElicitationOption={onSelectElicitationOption}
              onRegenerate={message.sender === 'assistant' ? handleRegenerate : undefined}
            />
          ))}

          {/* Typing / Streaming Indicator */}
          {isStreaming && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '8px 0 16px 44px',
                fontSize: '13px',
                color: '#64748b',
                fontStyle: 'italic',
              }}
            >
              <span className="streaming-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb' }} />
              <span className="streaming-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb', animationDelay: '0.2s' }} />
              <span className="streaming-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb', animationDelay: '0.4s' }} />
              <span style={{ marginLeft: '4px' }}>Karma is streaming...</span>
            </div>
          )}

          <div ref={transcriptEndRef} />
        </div>
      )}

      <style>{`
        @keyframes streamDotPulse {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
        .streaming-dot {
          display: inline-block;
          animation: streamDotPulse 1.2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default ChatView;
