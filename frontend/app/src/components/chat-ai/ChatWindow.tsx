import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  Sparkles,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import MessageBubble, { type ChatMessage } from './MessageBubble';
import ChatInput from './ChatInput';
import VoicePanel from './VoicePanel';
import { useSpeech } from '../../hooks/useSpeech';

interface ChatWindowProps {
  initialPrompt?: string;
  isVoiceModalOpen?: boolean;
  onCloseVoiceModal?: () => void;
  onOpenVoiceModal?: () => void;
}

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: 'intro-1',
    sender: 'assistant',
    text:
      "Hello! I'm **Karma** with voice and interactive reasoning.\n\n" +
      "You can chat with me here using Markdown and code, or click the **Voice** button to experience our animated **SoftAurora Orb** with real-time audio visualization.\n\n" +
      "How can I help you today?",
    timestamp: 'Just now',
  },
];

export const ChatWindow: React.FC<ChatWindowProps> = ({
  initialPrompt = '',
  isVoiceModalOpen: externalVoiceOpen,
  onCloseVoiceModal: externalOnCloseVoice,
  onOpenVoiceModal: externalOnOpenVoice,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(DEFAULT_MESSAGES);
  const [inputValue, setInputValue] = useState(initialPrompt);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [internalVoiceOpen, setInternalVoiceOpen] = useState(false);

  const isVoiceOpen = externalVoiceOpen !== undefined ? externalVoiceOpen : internalVoiceOpen;
  const openVoice = externalOnOpenVoice || (() => setInternalVoiceOpen(true));
  const closeVoice = externalOnCloseVoice || (() => setInternalVoiceOpen(false));

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Web Speech recognition for prompt box mic
  const { isListening } = useSpeech({
    onTranscript: (spokenText) => {
      setInputValue((prev) => (prev ? `${prev} ${spokenText}` : spokenText));
    },
  });

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Send message and stream SSE tokens from backend
  const handleSendMessage = useCallback(
    async (textToSend: string): Promise<string> => {
      const trimmed = textToSend.trim();
      if (!trimmed || isStreaming) return '';

      setStreamError(null);
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Add user message
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: trimmed,
        timestamp,
      };

      const assistantMsgId = `assistant-${Date.now()}`;
      const assistantPlaceholder: ChatMessage = {
        id: assistantMsgId,
        sender: 'assistant',
        text: '',
        timestamp,
      };

      const nextMessages = [...messages, userMsg, assistantPlaceholder];
      setMessages(nextMessages);
      setInputValue('');
      setIsStreaming(true);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      let accumulatedText = '';

      // Determine backend endpoint
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const apiEndpoint = isLocal ? 'http://localhost:3000/api/chat' : '/api/chat';

      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            message: trimmed,
            messages: nextMessages.slice(0, -1).map((m) => ({
              role: m.sender === 'user' ? 'user' : 'assistant',
              content: m.text,
            })),
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const lineTrimmed = line.trim();
            if (!lineTrimmed || lineTrimmed.startsWith(':')) continue;

            if (lineTrimmed.startsWith('data:')) {
              const dataStr = lineTrimmed.slice(5).trim();
              if (dataStr === '[DONE]') {
                break;
              }
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === 'token' && parsed.text) {
                  accumulatedText += parsed.text;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId ? { ...msg, text: accumulatedText } : msg
                    )
                  );
                }
              } catch (e) {
                // ignore partial json chunk
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('Stream cancelled by user');
        } else {
          console.warn('Backend chat stream error, fallback simulated reply:', err);
          setStreamError('Network error streaming response. Click retry.');
          // Provide friendly fallback text if backend was unreachable
          if (!accumulatedText) {
            accumulatedText =
              "I received your inquiry: **\"" +
              trimmed +
              "\"**.\n\n" +
              "- Connected to **Chat A.I** system.\n" +
              "- You can trigger voice mode anytime using the **Voice** button below.\n" +
              "- Click **Regenerate** or **Retry** to refresh this answer.";
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, text: accumulatedText } : msg
              )
            );
          }
        }
      } finally {
        setIsStreaming(false);
      }

      return accumulatedText;
    },
    [messages, isStreaming]
  );

  // New Chat handler
  const handleNewChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages(DEFAULT_MESSAGES);
    setInputValue('');
    setStreamError(null);
  };

  // Regenerate last assistant reply
  const handleRegenerate = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.sender === 'user');
    if (lastUserMsg) {
      handleSendMessage(lastUserMsg.text);
    }
  };

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 10, 140));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 10, 70));
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const latestAssistantReply = [...messages].reverse().find((m) => m.sender === 'assistant')?.text;

  return (
    <div
      className="chat-ai-outer-viewport"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: 'linear-gradient(180deg, #eef0fb 0%, #f6f5ff 100%)',
        fontFamily: "'Plus Jakarta Sans', 'Outfit', -apple-system, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Decorative vertical "Upgrade to Pro" tab on the right edge */}
      <div
        className="upgrade-to-pro-tab"
        style={{
          position: 'fixed',
          right: 0,
          top: '45%',
          transform: 'translateY(-50%)',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          padding: '12px 6px',
          borderRadius: '8px 0 0 8px',
          boxShadow: '-2px 4px 14px rgba(0, 0, 0, 0.12)',
          cursor: 'pointer',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRight: 'none',
          userSelect: 'none',
          transition: 'all 0.2s ease',
        }}
        onClick={() => alert('Upgrade to Pro: Unlimited Claude 3.5 Sonnet, GPT-4o, and ultra-high-fidelity voice!')}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-50%) translateX(-4px)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(-50%) translateX(0)')}
      >
        <Sparkles size={14} color="#f59e0b" />
        <span
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#f8fafc',
          }}
        >
          Upgrade to Pro
        </span>
      </div>

      {/* Main Full-Width Chat Card with subtle shadow and rounded corners */}
      <div
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 'none',
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 0 1px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          overflow: 'hidden',
          transform: `scale(${zoomLevel / 100})`,
          transformOrigin: 'center center',
          transition: 'transform 0.15s ease',
        }}
      >
        {/* Card Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 28px',
            borderBottom: '1px solid #f1f5f9',
            background: '#ffffff',
          }}
        >
          {/* Left: Word Karma & Model Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              Karma
            </span>

            {/* Model Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '9999px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
                color: '#475569',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <span>GPT-4o mini</span>
              <ChevronDown size={13} color="#94a3b8" />
            </div>
          </div>

          {/* Right Header: New Chat Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleNewChat}
              aria-label="Start new chat"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '9999px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#334155',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              <Plus size={14} />
              <span>New chat</span>
            </button>
          </div>
        </div>

        {/* Message Scrollable Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 32px 32px 32px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '960px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
            }}
          >
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onEdit={(text) => setInputValue(text)}
                onRegenerate={msg.sender === 'assistant' ? handleRegenerate : undefined}
              />
            ))}

            {/* Typing Indicator */}
            {isStreaming && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '8px 0 12px 44px',
                  fontSize: '13px',
                  color: '#64748b',
                  fontStyle: 'italic',
                }}
              >
                <span className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb' }} />
                <span className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb', animationDelay: '0.2s' }} />
                <span className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb', animationDelay: '0.4s' }} />
                <span style={{ marginLeft: '4px' }}>Karma is streaming...</span>
              </div>
            )}

            {/* Stream Error Alert with Retry */}
            {streamError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 14px',
                  margin: '8px 0',
                  borderRadius: '8px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>{streamError}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#ffffff',
                    border: '1px solid #fca5a5',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    color: '#b91c1c',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Retry</span>
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Docked bottom input container */}
        <div
          style={{
            padding: '14px 32px 20px 32px',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.85) 0%, #ffffff 100%)',
            borderTop: '1px solid #f1f5f9',
          }}
        >
          <div style={{ width: '100%', maxWidth: '960px', margin: '0 auto' }}>
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={(text) => handleSendMessage(text)}
              onOpenVoice={openVoice}
              onToggleMic={() => {
                // Open voice modal when mic is clicked or start listening
                openVoice();
              }}
              isListening={isListening}
              disabled={isStreaming}
            />
          </div>
        </div>
      </div>

      {/* Bottom-right Zoom Control (– 100% +) plus Fullscreen Toggle */}
      <div
        className="zoom-fullscreen-control"
        style={{
          position: 'fixed',
          right: '28px',
          bottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #e2e8f0',
          borderRadius: '9999px',
          padding: '4px 10px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          zIndex: 40,
        }}
      >
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ZoomOut size={13} />
        </button>

        <span
          style={{
            fontSize: '11.5px',
            fontWeight: 600,
            color: '#334155',
            minWidth: '40px',
            textAlign: 'center',
            userSelect: 'none',
          }}
        >
          {zoomLevel}%
        </span>

        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ZoomIn size={13} />
        </button>

        <div style={{ width: '1px', height: '14px', background: '#e2e8f0', margin: '0 4px' }} />

        <button
          type="button"
          onClick={handleToggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Toggle fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* Voice Agent Modal with Aurora Orb */}
      <VoicePanel
        isOpen={isVoiceOpen}
        onClose={closeVoice}
        onSendMessage={async (spokenPrompt) => {
          return await handleSendMessage(spokenPrompt);
        }}
        latestAssistantReply={latestAssistantReply}
      />

      <style>{`
        @keyframes typingPulse {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
        .typing-dot {
          display: inline-block;
          animation: typingPulse 1.2s infinite ease-in-out;
        }
        @media (max-width: 768px) {
          .upgrade-to-pro-tab {
            display: none !important;
          }
          .zoom-fullscreen-control {
            bottom: 12px !important;
            right: 12px !important;
            padding: 3px 8px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ChatWindow;
