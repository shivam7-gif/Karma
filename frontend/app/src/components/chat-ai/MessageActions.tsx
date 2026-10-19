import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Copy, Check, MoreVertical, RefreshCw } from 'lucide-react';

interface MessageActionsProps {
  messageText: string;
  onRegenerate?: () => void;
}

export const MessageActions: React.FC<MessageActionsProps> = ({ messageText, onRegenerate }) => {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [copied, setCopied] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '8px',
        paddingTop: '6px',
        borderTop: '1px solid #f1f5f9',
        fontSize: '12px',
        color: '#64748b',
        position: 'relative',
      }}
    >
      {/* Left Action Buttons: Thumbs Up, Thumbs Down, Copy, More */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Thumbs Up */}
        <button
          type="button"
          onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
          aria-label="Good response"
          title="Good response"
          style={{
            padding: '4px',
            borderRadius: '6px',
            border: 'none',
            background: feedback === 'up' ? '#eff6ff' : 'transparent',
            color: feedback === 'up' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (feedback !== 'up') e.currentTarget.style.color = '#0f172a';
          }}
          onMouseLeave={(e) => {
            if (feedback !== 'up') e.currentTarget.style.color = '#64748b';
          }}
        >
          <ThumbsUp size={14} />
        </button>

        {/* Thumbs Down */}
        <button
          type="button"
          onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
          aria-label="Poor response"
          title="Poor response"
          style={{
            padding: '4px',
            borderRadius: '6px',
            border: 'none',
            background: feedback === 'down' ? '#fef2f2' : 'transparent',
            color: feedback === 'down' ? '#dc2626' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (feedback !== 'down') e.currentTarget.style.color = '#0f172a';
          }}
          onMouseLeave={(e) => {
            if (feedback !== 'down') e.currentTarget.style.color = '#64748b';
          }}
        >
          <ThumbsDown size={14} />
        </button>

        {/* Copy */}
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy message'}
          title={copied ? 'Copied to clipboard' : 'Copy message'}
          style={{
            padding: '4px',
            borderRadius: '6px',
            border: 'none',
            background: copied ? '#ecfdf5' : 'transparent',
            color: copied ? '#059669' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!copied) e.currentTarget.style.color = '#0f172a';
          }}
          onMouseLeave={(e) => {
            if (!copied) e.currentTarget.style.color = '#64748b';
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>

        {/* More Menu */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            aria-label="More actions"
            title="More actions"
            style={{
              padding: '4px',
              borderRadius: '6px',
              border: 'none',
              background: showMore ? '#f1f5f9' : 'transparent',
              color: showMore ? '#0f172a' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <MoreVertical size={14} />
          </button>

          {showMore && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                bottom: '100%',
                marginBottom: '6px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                padding: '4px',
                display: 'flex',
                flexDirection: 'column',
                minWidth: '130px',
                zIndex: 20,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  handleCopy();
                  setShowMore(false);
                }}
                style={{
                  textAlign: 'left',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '12px',
                  color: '#334155',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Copy Text
              </button>
              <button
                type="button"
                onClick={() => {
                  alert('Message pinned to conversation context');
                  setShowMore(false);
                }}
                style={{
                  textAlign: 'left',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '12px',
                  color: '#334155',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Pin Message
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Action: Regenerate button */}
      {onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          aria-label="Regenerate response"
          title="Regenerate this response"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 8px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            color: '#475569',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f8fafc';
            e.currentTarget.style.color = '#0f172a';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.color = '#475569';
            e.currentTarget.style.borderColor = '#e2e8f0';
          }}
        >
          <RefreshCw size={12} />
          <span>Regenerate</span>
        </button>
      )}
    </div>
  );
};

export default MessageActions;
