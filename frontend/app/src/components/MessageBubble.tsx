import React, { useState, useEffect, useRef, useId } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import type { Message } from '../api/types';
import { ElicitationCard } from './ElicitationCard';
import { CheckSquare, Pencil, Copy, Check } from 'lucide-react';
import { useAppStore } from '../store/appStore';
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
                borderBottom: '2px solid var(--border-glass, #e7e2d8)',
                padding: '7px 12px',
                fontWeight: 650,
                background: 'rgba(0, 0, 0, 0.03)',
                color: 'var(--text-primary, #19161d)',
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
                borderBottom: '1px solid var(--border-glass, #e7e2d8)',
                padding: '7px 12px',
                color: 'var(--text-primary, #19161d)',
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
                color: 'var(--text-primary, #19161d)',
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
                color: 'var(--text-primary, #19161d)',
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
                color: 'var(--text-primary, #19161d)',
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
                borderLeft: '3px solid var(--accent, #8b3dff)',
                color: 'var(--text-secondary, #575260)',
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
          /* User Message: Crisp white strip with edit icon visible on hover */
          <div
            className="message-user-strip"
            style={{
              background: '#ffffff',
              border: '1px solid var(--border-glass, #e7e2d8)',
              borderRadius: 'var(--r-lg, 16px) var(--r-lg, 16px) 4px var(--r-lg, 16px)',
              padding: '10px 16px',
              color: 'var(--text-primary, #19161d)',
              fontSize: '14.5px',
              lineHeight: 1.5,
              boxShadow: 'var(--shadow-soft, 0 1px 3px rgba(0, 0, 0, 0.03))',
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
                color: 'var(--text-muted, #8e8798)',
                cursor: 'pointer',
                padding: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--r-sm, 10px)',
                opacity: 0,
                transition: 'all var(--transition-fast, 150ms ease)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent, #8b3dff)';
                e.currentTarget.style.background = 'var(--surface-glass-hover, #f5f2ec)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted, #8e8798)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Pencil size={12} strokeWidth={1.8} />
            </button>
          </div>
        ) : (
          /* Assistant Message: Clean Card with Karma label and Markdown */
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Karma label */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--accent, #8b3dff)',
                letterSpacing: '0.04em',
                marginBottom: '4px',
                textTransform: 'uppercase',
              }}
            >
              Karma
            </div>

            <div
              className="message-assistant-card"
              style={{
                background: '#ffffff',
                border: '1px solid var(--border-glass, #e7e2d8)',
                borderRadius: '4px var(--r-lg, 16px) var(--r-lg, 16px) var(--r-lg, 16px)',
                padding: '14px 18px',
                boxShadow: 'var(--shadow-soft, 0 1px 4px rgba(0, 0, 0, 0.03))',
                color: 'var(--text-primary, #19161d)',
                fontSize: '14.5px',
                lineHeight: 1.6,
                wordBreak: 'break-word',
                position: 'relative',
              }}
            >
              <ChatMarkdownRenderer text={renderedText || '…'} isStreaming={isCurrentlyStreaming} />
              {/* Only show action bar for replies longer than ~2 lines (> 80 chars) */}
              {(message.text?.length || 0) > 80 && (
                <div className="message-actions-wrapper">
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
