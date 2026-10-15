import React from 'react';
import { Terminal, X, Trash2, Clock, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store/appStore';

export const TracePanel: React.FC = () => {
  const { tracePanelOpen, setTracePanelOpen, traceItems, clearTrace } = useAppStore();

  if (!tracePanelOpen) return null;

  return (
    <div
      role="region"
      aria-label="Execution Trace Console"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '280px',
        maxHeight: '45vh',
        background: 'rgba(6, 11, 20, 0.95)',
        backdropFilter: 'var(--blur-heavy)',
        WebkitBackdropFilter: 'var(--blur-heavy)',
        borderTop: '1px solid var(--border-glass-light)',
        borderBottomLeftRadius: 'var(--radius-outer)',
        borderBottomRightRadius: 'var(--radius-outer)',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.6)',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Console Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid var(--border-glass)',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={14} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
            Live Assistant Trace
          </span>
          <span
            style={{
              background: 'rgba(76, 141, 255, 0.15)',
              color: 'var(--accent-blue)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: '11px',
              fontWeight: 500,
            }}
          >
            {traceItems.length} events
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={clearTrace}
            disabled={traceItems.length === 0}
            title="Clear trace console"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              color: traceItems.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
              cursor: traceItems.length > 0 ? 'pointer' : 'default',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'inherit',
            }}
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={() => setTracePanelOpen(false)}
            title="Close trace panel"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Console Log Items */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {traceItems.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}
          >
            No events recorded yet. Send a prompt to inspect live tool calls and SSE events.
          </div>
        ) : (
          traceItems.map((item) => (
            <div
              key={item.id}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-glass)',
                borderRadius: '6px',
                padding: '8px 12px',
                lineHeight: 1.4,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {item.status === 'running' && (
                    <Loader2 size={13} className="trace-spinner" style={{ color: 'var(--accent-blue)', animation: 'spin 1s linear infinite' }} />
                  )}
                  {item.status === 'completed' && (
                    <CheckCircle2 size={13} style={{ color: 'var(--status-success)' }} />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle size={13} style={{ color: 'var(--status-error)' }} />
                  )}

                  <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                    {item.name}
                  </span>

                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    {item.timestamp}
                  </span>
                </div>

                {item.ms !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                    <Clock size={11} />
                    <span>{item.ms}ms</span>
                  </div>
                )}
              </div>

              {/* Arguments */}
              {item.args && (
                <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span style={{ color: '#FCD34D' }}>args: </span>
                  <code>{JSON.stringify(item.args)}</code>
                </div>
              )}

              {/* Result */}
              {item.result && (
                <div style={{ color: 'var(--text-primary)' }}>
                  <span style={{ color: '#34D399' }}>result: </span>
                  <code>{typeof item.result === 'string' ? item.result : JSON.stringify(item.result)}</code>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
