import React, { useState, useEffect, useRef, useId } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import type { Message } from '../api/types';
import { ElicitationCard } from './ElicitationCard';
import { CheckSquare, Pencil, Copy, Check } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { UnifiedSwarmPanel } from './UnifiedSwarmPanel';
import MessageActions from './chat-ai/MessageActions';
import { preprocessStreamingMarkdown } from '../utils/markdownUtils';

interface MessageBubbleProps {
  message: Message;
  onSelectElicitationOption?: (messageId: string, option: string) => void;
  onRegenerate?: () => void;
}

// Lazy Mermaid Renderer with fallback to CodeBlock
const MermaidBlock: React.FC<{ code: string }> = ({ code }) => {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rawId = useId();
  const idRef = useRef(`mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}-${Math.random().toString(36).slice(2, 6)}`);

  useEffect(() => {
    let isCancelled = false;
    const trimmed = code.trim();
    if (!trimmed) return;

    import('mermaid')
      .then((mermaidModule) => {
        if (isCancelled) return;
        const mermaid = mermaidModule.default || mermaidModule;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          securityLevel: 'loose',
        });
        mermaid
          .render(idRef.current, trimmed)
          .then(({ svg }) => {
            if (!isCancelled) {
              setSvg(svg);
              setError(null);
            }
          })
          .catch((err) => {
            if (!isCancelled) {
              setError(err instanceof Error ? err.message : String(err));
            }
          });
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [code]);

  if (error) {
    return <CodeBlock language="mermaid" code={code} />;
  }

  if (!svg) {
    return (
      <div
        style={{
          padding: '12px 16px',
          color: '#8e8798',
          fontSize: '12px',
          fontFamily: "'JetBrains Mono', Consolas, monospace",
          background: 'rgba(0, 0, 0, 0.03)',
          borderRadius: '8px',
          margin: '8px 0',
        }}
      >
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      style={{
        margin: '12px 0',
        padding: '14px',
        background: '#ffffff',
        borderRadius: '10px',
        border: '1px solid var(--border-glass, #e7e2d8)',
        overflowX: 'auto',
        maxWidth: '100%',
        display: 'flex',
        justifyContent: 'center',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

// Markdown Code Block with Copy Button
const CodeBlock: React.FC<{ language?: string; code: string; className?: string }> = ({
  language,
  code,
  className,
}) => {
  const [copied, setCopied] = useState(false);

  // An empty fence must not render as an empty box
  if (!code || !code.trim()) {
    return null;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="code-block-container"
      style={{
        margin: '12px 0',
        borderRadius: '10px',
        overflow: 'hidden',
        background: '#0d1117',
        border: '1px solid #30363d',
        fontSize: '13px',
        maxWidth: '100%',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          background: '#161b22',
          borderBottom: '1px solid #30363d',
          color: '#8b949e',
          fontSize: '11px',
          fontFamily: "'JetBrains Mono', Consolas, monospace",
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code block"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'transparent',
            border: 'none',
            color: copied ? '#3fb950' : '#8b949e',
            cursor: 'pointer',
            fontSize: '11px',
            fontFamily: 'inherit',
            padding: '2px 6px',
            borderRadius: '4px',
            transition: 'color 0.15s ease',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '12px 14px',
          overflowX: 'auto',
          whiteSpace: 'pre',
          color: '#e6edf3',
          fontFamily: "'JetBrains Mono', Consolas, monospace",
          lineHeight: 1.45,
          fontSize: '12.5px',
          maxWidth: '100%',
        }}
      >
        <code className={className}>{code}</code>
      </pre>
    </div>
  );
};

// Rich Markdown renderer with react-markdown and rehype-highlight
const ChatMarkdownRenderer: React.FC<{ text: string; isStreaming: boolean }> = ({ text, isStreaming }) => {
  const processed = preprocessStreamingMarkdown(text, isStreaming);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code({ node, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const rawCode = String(children).replace(/\n$/, '');
          const isBlock = Boolean(match) || rawCode.includes('\n');

          if (match && match[1] === 'mermaid') {
            return <MermaidBlock code={rawCode} />;
          }

          if (isBlock) {
            return (
              <CodeBlock
                language={match ? match[1] : ''}
                code={rawCode}
                className={className}
              />
            );
          }

          // Inline code badge
          return (
            <code
              style={{
                background: 'rgba(0, 0, 0, 0.05)',
                color: 'var(--text-primary, #19161d)',
                padding: '2px 5px',
                borderRadius: '4px',
                fontSize: '0.88em',
                fontFamily: "'JetBrains Mono', Consolas, monospace",
                wordBreak: 'break-word',
              }}
              {...props}
            >
              {children}
            </code>
          );
        },
        pre({ children }) {
          // Flatten pre to let CodeBlock handle its own container & pre tag
          return <>{children}</>;
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#111111',
                textDecoration: 'underline',
                fontWeight: 500,
              }}
            >
              {children}
            </a>
          );
        },
        img({ src, alt }) {
          return (
            <span style={{ display: 'block', margin: '8px 0' }}>
              <img
                src={src}
                alt={alt || ''}
                loading="lazy"
                style={{
                  maxWidth: '100%',
                  maxHeight: '260px',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  objectFit: 'cover',
                  display: 'block',
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </span>
          );
        },
        table({ children }) {
          return (
            <div style={{ overflowX: 'auto', margin: '12px 0', maxWidth: '100%' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13.5px',
                  lineHeight: 1.5,
                  textAlign: 'left',
                }}
              >
                {children}
              </table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th
              style={{
                borderBottom: '2px solid #e5e7eb',
                padding: '7px 12px',
                fontWeight: 650,
                background: '#f9fafb',
                color: '#111111',
              }}
            >
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td
              style={{
                borderBottom: '1px solid #e5e7eb',
                padding: '7px 12px',
                color: '#111111',
              }}
            >
              {children}
            </td>
          );
        },
        h1({ children }) {
          return (
            <h1
              style={{
                margin: '12px 0 6px 0',
                fontSize: '16px',
                fontWeight: 700,
                color: '#111111',
                letterSpacing: '-0.01em',
              }}
            >
              {children}
            </h1>
          );
        },
        h2({ children }) {
          return (
            <h2
              style={{
                margin: '11px 0 5px 0',
                fontSize: '15px',
                fontWeight: 700,
                color: '#111111',
                letterSpacing: '-0.01em',
              }}
            >
              {children}
            </h2>
          );
        },
        h3({ children }) {
          return (
            <h3
              style={{
                margin: '9px 0 4px 0',
                fontSize: '14px',
                fontWeight: 650,
                color: '#111111',
              }}
            >
              {children}
            </h3>
          );
        },
        p({ children }) {
          return (
            <p
              style={{
                margin: '0 0 8px 0',
                lineHeight: 1.6,
                color: '#111111',
              }}
            >
              {children}
            </p>
          );
        },
        ul({ children }) {
          return (
            <ul
              style={{
                margin: '4px 0 8px 0',
                paddingLeft: '20px',
                lineHeight: 1.6,
                color: '#111111',
              }}
            >
              {children}
            </ul>
          );
        },
        ol({ children }) {
          return (
            <ol
              style={{
                margin: '4px 0 8px 0',
                paddingLeft: '20px',
                lineHeight: 1.6,
                color: '#111111',
              }}
            >
              {children}
            </ol>
          );
        },
        li({ children }) {
          return (
            <li
              style={{
                margin: '3px 0',
                color: '#111111',
              }}
            >
              {children}
            </li>
          );
        },
        blockquote({ children }) {
          return (
            <blockquote
              style={{
                margin: '8px 0',
                paddingLeft: '12px',
                borderLeft: '3px solid #111111',
                color: '#4b5563',
                fontStyle: 'italic',
              }}
            >
              {children}
            </blockquote>
          );
        },
      }}
    >
      {processed}
    </ReactMarkdown>
  );
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onSelectElicitationOption,
  onRegenerate,
}) => {
  const { deviceMode, setInputValue, isStreaming, messages } = useAppStore();
  const isUser = message.sender === 'user';
  const isCurrentlyStreaming = isStreaming && messages[messages.length - 1]?.id === message.id;
  const assistantMessages = messages.filter((m) => m.sender === 'assistant');
  const isLatestAssistant = !isUser && assistantMessages[assistantMessages.length - 1]?.id === message.id;

  // Render at most once per animation frame (requestAnimationFrame throttle)
  const [renderedText, setRenderedText] = useState(message.text);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isCurrentlyStreaming) {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      setRenderedText(message.text);
      return;
    }
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      setRenderedText(message.text);
    });
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [message.text, isCurrentlyStreaming]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '20px',
        width: '100%',
        maxWidth: '820px',
        margin: '0 auto 20px auto',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
          flexDirection: isUser ? 'row-reverse' : 'row',
          maxWidth: '100%',
          width: isUser ? 'auto' : '100%',
        }}
      >
        {/* Message Content Container */}
        {isUser ? (
          /* User Message: compact, right-aligned, light-grey surface with subtle border */
          <div
            className="message-user-strip"
            style={{
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '10px 14px',
              color: '#111111',
              fontSize: '14.5px',
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              maxWidth: '680px',
              position: 'relative',
            }}
          >
            <span>{message.text}</span>
            <button
              type="button"
              className="message-edit-btn"
              onClick={() => setInputValue(message.text)}
              aria-label="Edit message"
              title="Edit prompt"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                padding: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                opacity: 0,
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#111111';
                e.currentTarget.style.background = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#6b7280';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Pencil size={12} strokeWidth={1.8} />
            </button>
          </div>
        ) : (
          /* Assistant Message: left-aligned, white background, black text, no unnecessary chat bubble */
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Karma label */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#111111',
                letterSpacing: '0.06em',
                marginBottom: '6px',
                textTransform: 'uppercase',
              }}
            >
              Karma
            </div>

            {/* Unified Swarm Response Panel (Agent activity, Websites visited, Research findings & photos) */}
            {isLatestAssistant && <UnifiedSwarmPanel />}

            {/* Main AI Response / Final Synthesis Plan */}
            <div
              className="message-assistant-body"
              style={{
                background: '#FFFFFF',
                color: '#111111',
                fontSize: '14.5px',
                lineHeight: 1.6,
                wordBreak: 'break-word',
                position: 'relative',
              }}
            >
              {renderedText ? (
                <ChatMarkdownRenderer text={renderedText} isStreaming={isCurrentlyStreaming} />
              ) : isCurrentlyStreaming ? (
                <div style={{ color: '#6b7280', fontSize: '13.5px', fontStyle: 'italic', padding: '4px 0' }}>
                  Planning and coordinating swarm agents...
                </div>
              ) : null}

              {(message.text?.length || 0) > 80 && (
                <div className="message-actions-wrapper" style={{ marginTop: '8px' }}>
                  <MessageActions messageText={message.text} onRegenerate={onRegenerate} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Screen Mode: Rich Cards (inline) */}
      {!isUser && deviceMode === 'screen' && message.richCard && (
        <div
          style={{
            marginLeft: '0',
            marginTop: '12px',
            padding: '16px',
            borderRadius: '12px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
            width: '100%',
            maxWidth: '520px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <CheckSquare size={16} style={{ color: '#2563eb' }} />
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
              {message.richCard.title}
            </h4>
          </div>
          {message.richCard.details && (
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
              {message.richCard.details}
            </p>
          )}
          {message.richCard.items && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {message.richCard.items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ color: '#1e293b' }}>{item.label}</span>
                  {item.count !== undefined && (
                    <span style={{ color: '#64748b', fontSize: '12px' }}>
                      {item.count} items
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Elicitation Follow-Up Card */}
      {!isUser && message.elicitation && (
        <div style={{ marginLeft: '0', marginTop: '10px', width: '100%', maxWidth: '520px' }}>
          <ElicitationCard
            question={message.elicitation.question}
            options={message.elicitation.options}
            answered={message.elicitation.answered}
            onSelectOption={(option) => {
              if (onSelectElicitationOption) {
                onSelectElicitationOption(message.id, option);
              }
            }}
          />
        </div>
      )}

      <style>{`
        .message-user-strip:hover .message-edit-btn,
        .message-user-strip:focus-within .message-edit-btn {
          opacity: 1 !important;
        }
        .message-actions-wrapper {
          opacity: 0;
          transition: opacity var(--transition-fast, 150ms ease);
        }
        .message-assistant-card:hover .message-actions-wrapper,
        .message-assistant-card:focus-within .message-actions-wrapper {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};

export default MessageBubble;
