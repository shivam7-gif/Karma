import React, { useState } from 'react';
import type { Message } from '../api/types';
import { BrandRingIcon } from './BrandLogo';
import { ElicitationCard } from './ElicitationCard';
import { CheckSquare, Pencil, Copy, Check } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import MessageActions from './chat-ai/MessageActions';

interface MessageBubbleProps {
  message: Message;
  onSelectElicitationOption?: (messageId: string, option: string) => void;
  onRegenerate?: () => void;
}

// Markdown Code Block with Copy Button
const CodeBlock: React.FC<{ language?: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        margin: '12px 0',
        borderRadius: '10px',
        overflow: 'hidden',
        background: '#1e293b',
        border: '1px solid #334155',
        fontSize: '13px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: '#0f172a',
          borderBottom: '1px solid #334155',
          color: '#94a3b8',
          fontSize: '11px',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
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
            gap: '4px',
            background: 'transparent',
            border: 'none',
            color: copied ? '#34d399' : '#94a3b8',
            cursor: 'pointer',
            fontSize: '11px',
            fontFamily: 'inherit',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '12px',
          overflowX: 'auto',
          color: '#f8fafc',
          fontFamily: "'JetBrains Mono', Consolas, monospace",
          lineHeight: 1.5,
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
};

// Inline formatter for bold **text** and inline `code`
const renderInlineFormatted = (raw: string) => {
  const tokens = raw.split(/(\*\*.*?\*\*|`.*?`)/g);

  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={idx} style={{ fontWeight: 650, color: '#0f172a' }}>
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code
          key={idx}
          style={{
            background: '#f1f5f9',
            color: '#0f172a',
            padding: '2px 5px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: "'JetBrains Mono', Consolas, monospace",
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return token;
  });
};

// Markdown parser
const renderMarkdown = (text: string) => {
  if (!text) return null;

  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const firstLineBreak = part.indexOf('\n');
      let lang = '';
      let code = '';
      if (firstLineBreak !== -1) {
        lang = part.slice(3, firstLineBreak).trim();
        code = part.slice(firstLineBreak + 1, -3);
      } else {
        code = part.slice(3, -3);
      }
      return <CodeBlock key={index} language={lang} code={code} />;
    }

    const lines = part.split('\n');
    return (
      <div key={index}>
        {lines.map((line, lIdx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={lIdx} style={{ height: '6px' }} />;
          }

          if (/^[-*]\s+/.test(trimmed)) {
            const content = trimmed.replace(/^[-*]\s+/, '');
            return (
              <li key={lIdx} style={{ marginLeft: '18px', marginBottom: '4px', lineHeight: 1.6 }}>
                {renderInlineFormatted(content)}
              </li>
            );
          }

          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <div key={lIdx} style={{ display: 'flex', gap: '8px', marginBottom: '6px', lineHeight: 1.6 }}>
                <span style={{ fontWeight: 600, color: '#2563eb' }}>{numMatch[1]}.</span>
                <span>{renderInlineFormatted(numMatch[2])}</span>
              </div>
            );
          }

          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={lIdx} style={{ margin: '10px 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                {renderInlineFormatted(trimmed.slice(4))}
              </h4>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={lIdx} style={{ margin: '14px 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                {renderInlineFormatted(trimmed.slice(3))}
              </h3>
            );
          }

          return (
            <p key={lIdx} style={{ margin: '0 0 6px 0', lineHeight: 1.6 }}>
              {renderInlineFormatted(line)}
            </p>
          );
        })}
      </div>
    );
  });
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onSelectElicitationOption,
  onRegenerate,
}) => {
  const { deviceMode, setInputValue } = useAppStore();
  const isUser = message.sender === 'user';

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
        {/* Assistant Avatar indicator */}
        {!isUser && (
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
              marginTop: '4px',
            }}
            aria-hidden="true"
          >
            <BrandRingIcon size={22} />
          </div>
        )}

        {/* Message Content Container */}
        {isUser ? (
          /* User Message: Crisp white strip with edit icon */
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '16px 16px 4px 16px',
              padding: '10px 16px',
              color: '#0f172a',
              fontSize: '14.5px',
              lineHeight: 1.5,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              maxWidth: '680px',
            }}
          >
            <span>{message.text}</span>
            <button
              type="button"
              onClick={() => setInputValue(message.text)}
              aria-label="Edit message"
              title="Edit prompt"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#2563eb')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
            >
              <Pencil size={12} />
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
                fontWeight: 700,
                color: '#2563eb',
                letterSpacing: '0.04em',
                marginBottom: '4px',
              }}
            >
              Karma
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '4px 18px 18px 18px',
                padding: '14px 18px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
                color: '#334155',
                fontSize: '14.5px',
                lineHeight: 1.6,
                wordBreak: 'break-word',
              }}
            >
              {renderMarkdown(message.text || '...')}
              <MessageActions messageText={message.text} onRegenerate={onRegenerate} />
            </div>
          </div>
        )}
      </div>

      {/* Screen Mode: Rich Cards (inline) */}
      {!isUser && deviceMode === 'screen' && message.richCard && (
        <div
          style={{
            marginLeft: '44px',
            marginTop: '12px',
            padding: '16px',
            borderRadius: '12px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
            width: 'calc(100% - 44px)',
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
        <div style={{ marginLeft: '44px', marginTop: '10px', width: 'calc(100% - 44px)', maxWidth: '520px' }}>
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
    </div>
  );
};

export default MessageBubble;
