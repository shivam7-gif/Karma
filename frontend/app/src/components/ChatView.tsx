import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { MessageBubble } from './MessageBubble';
import { useChatStream } from '../hooks/useChatStream';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ChatViewProps {
  onSelectElicitationOption: (messageId: string, option: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ onSelectElicitationOption }) => {
  const { messages, isStreaming, streamError, agentLifecycle, orchestratorTasks } = useAppStore();
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const { handleSendMessage } = useChatStream();

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, streamError, agentLifecycle, orchestratorTasks]);

  const lastAssistantMessage = [...messages].reverse().find((m) => m.sender === 'assistant');
  const lastUserMessage = [...messages].reverse().find((m) => m.sender === 'user');

  // True if streaming has started but no tokens have arrived yet in the assistant message
  const isWaitingForFirstToken =
    isStreaming &&
    lastAssistantMessage &&
    (!lastAssistantMessage.text || lastAssistantMessage.text.trim().length === 0) &&
    orchestratorTasks.length === 0;

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
        background: '#FFFFFF',
      }}
    >
      <div style={{ flex: 1, width: '100%' }}>
        {messages.map((message) => {
          // If this is the currently streaming empty assistant placeholder without tasks, don't render an empty bubble yet
          if (message.id === lastAssistantMessage?.id && isWaitingForFirstToken) {
            return null;
          }
          return (
            <MessageBubble
              key={message.id}
              message={message}
              onSelectElicitationOption={onSelectElicitationOption}
              onRegenerate={message.sender === 'assistant' ? handleRegenerate : undefined}
            />
          );
        })}

        {/* Live Single-Agent Lifecycle Status Badge (only when not in swarm mission) */}
        {isStreaming && orchestratorTasks.length === 0 && agentLifecycle && agentLifecycle.status !== 'completed' && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 12px',
              borderRadius: '4px',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              color: '#111111',
              fontSize: '12px',
              fontWeight: 500,
              marginBottom: '12px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#111111',
              }}
            />
            <span>{agentLifecycle.message}</span>
          </div>
        )}

        {/* Small typing indicator before first token arrives in single agent mode */}
        {isWaitingForFirstToken && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '4px',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              marginBottom: '16px',
              marginLeft: '0',
            }}
          >
            <span
              className="typing-dot"
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--accent, #8b3dff)',
              }}
            />
            <span
              className="typing-dot"
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--accent, #8b3dff)',
                animationDelay: '0.15s',
              }}
            />
            <span
              className="typing-dot"
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--accent, #8b3dff)',
                animationDelay: '0.3s',
              }}
            />
          </div>
        )}

        {/* Error State with Retry Button */}
        {streamError && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: 'var(--r-md, 14px)',
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              color: '#9f1239',
              fontSize: '13px',
              margin: '12px 0 16px 0',
              boxShadow: 'var(--shadow-soft, 0 1px 3px rgba(0, 0, 0, 0.03))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span>{streamError}</span>
            </div>
            <button
              type="button"
              onClick={handleRegenerate}
              aria-label="Retry message"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: 'var(--r-sm, 10px)',
                background: '#be123c',
                border: 'none',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all var(--transition-fast, 150ms ease)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
            >
              <RefreshCw size={12} />
              <span>Retry</span>
            </button>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      <style>{`
        @keyframes typingPulse {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.35;
          }
          50% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
        .typing-dot {
          display: inline-block;
          animation: typingPulse 1s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default ChatView;
