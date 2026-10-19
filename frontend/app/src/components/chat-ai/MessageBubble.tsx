import React, { useState } from 'react';
import { Pencil, Copy, Check, Bot } from 'lucide-react';
import MessageActions from './MessageActions';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp?: string;
}

interface MessageBubbleProps {
  message: ChatMessage;
  userAvatar?: string;
  onEdit?: (text: string) => void;
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

// Markdown text parser for bold, lists, and code blocks
const renderMarkdown = (text: string) => {
  if (!text) return null;

  // Split by code blocks ```
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

    // Process non-codeblock text (paragraphs, lists, bold, inline code)
    const lines = part.split('\n');
    return (
      <div key={index}>
        {lines.map((line, lIdx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={lIdx} style={{ height: '8px' }} />;
          }

          // Bullet list (- or *)
          if (/^[-*]\s+/.test(trimmed)) {
            const content = trimmed.replace(/^[-*]\s+/, '');
            return (
              <li
                key={lIdx}
                style={{
                  marginLeft: '20px',
                  marginBottom: '4px',
                  lineHeight: 1.6,
                }}
              >
                {renderInlineFormatted(content)}
              </li>
            );
          }

          // Numbered list (1. 2. etc)
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <div
                key={lIdx}
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '6px',
                  lineHeight: 1.6,
                }}
              >
                <span style={{ fontWeight: 600, color: '#2563eb' }}>{numMatch[1]}.</span>
                <span>{renderInlineFormatted(numMatch[2])}</span>
              </div>
            );
          }

          // Headings (### or ##)
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
            <p key={lIdx} style={{ margin: '0 0 6px 0', lineHeight: 1.65 }}>
              {renderInlineFormatted(line)}
            </p>
          );
        })}
      </div>
    );
  });
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

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  userAvatar,
  onEdit,
  onRegenerate,
}) => {
  const isUser = message.sender === 'user';

  if (isUser) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          margin: '18px 0',
          width: '100%',
        }}
      >
        {/* User avatar on left */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#e0e7ff',
            border: '1px solid #c7d2fe',
            color: '#4338ca',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {userAvatar ? (
            <img src={userAvatar} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            'U'
          )}
        </div>

        {/* User's message in plain text on a white strip with a small edit icon at the right */}
        <div
          style={{
            flex: 1,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '10px 14px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '14px', color: '#1e293b', lineHeight: 1.5 }}>
            {message.text}
          </span>

          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(message.text)}
              aria-label="Edit user message"
              title="Edit message"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#0f172a';
                e.currentTarget.style.background = '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Assistant Message Row
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        margin: '18px 0',
        width: '100%',
      }}
    >
      {/* Small round bot avatar on left */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
        }}
      >
        <Bot size={18} />
      </div>

      {/* Main Bot Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Karma label above bot replies */}
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

        {/* Bot replies render Markdown and stream token by token */}
        <div
          style={{
            fontSize: '14.5px',
            color: '#334155',
            lineHeight: 1.6,
          }}
        >
          {renderMarkdown(message.text || '...')}
        </div>

        {/* Under each bot reply, show action bar */}
        <MessageActions messageText={message.text} onRegenerate={onRegenerate} />
      </div>
    </div>
  );
};

export default MessageBubble;
