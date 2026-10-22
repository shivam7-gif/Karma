import React, { useState } from 'react';
import { Sparkles, Send, Check, X } from 'lucide-react';
import { ideApi } from '../../api/ideApi';
import type { PatchProposal } from '../../types/ide';

interface CodingAgentSidebarProps {
  activeFile?: string;
  selectedText?: string;
  onPatchApplied?: (filePath: string) => void;
}

export const CodingAgentSidebar: React.FC<CodingAgentSidebarProps> = ({
  activeFile,
  selectedText,
  onPatchApplied,
}) => {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Karma Coding Engine ready. Select files, highlight code, or ask for architecture analysis, refactoring, or test generation.',
    },
  ]);
  const [activity, setActivity] = useState<string | null>(null);
  const [proposals, setProposals] = useState<PatchProposal[]>([]);
  const [isWorking, setIsWorking] = useState(false);

  const handleStartTask = async (customPrompt?: string, actionType?: string) => {
    const text = (customPrompt || prompt).trim();
    if (!text && !actionType) return;

    setMessages((prev) => [...prev, { role: 'user', text: text || `Action: ${actionType}` }]);
    setPrompt('');
    setIsWorking(true);
    setActivity('Initializing coding agents...');

    try {
      const { taskId } = await ideApi.startCodingTask({
        prompt: text,
        actionType,
        activeFile,
        selectedText,
      });

      ideApi.streamCodingTask(taskId, (event) => {
        if (event.type === 'progress') {
          setActivity(event.message);
        } else if (event.type === 'done') {
          setIsWorking(false);
          setActivity(null);

          let reply = event.plan || 'Task completed.';
          if (event.reviewerNotes) {
            reply += `\n\nReviewer Notes:\n${event.reviewerNotes}`;
          }
          setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);

          if (event.proposals && event.proposals.length > 0) {
            setProposals((prev) => [...prev, ...event.proposals]);
          }
        } else if (event.type === 'error') {
          setIsWorking(false);
          setActivity(null);
          setMessages((prev) => [...prev, { role: 'assistant', text: `Error: ${event.error}` }]);
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setIsWorking(false);
      setActivity(null);
      setMessages((prev) => [...prev, { role: 'assistant', text: `Error: ${msg}` }]);
    }
  };

  const handleApply = async (patch: PatchProposal) => {
    try {
      await ideApi.applyPatch(patch.patchId);
      setProposals((prev) =>
        prev.map((p) => (p.patchId === patch.patchId ? { ...p, status: 'applied' } : p))
      );
      onPatchApplied?.(patch.filePath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Could not apply patch: ${msg}`);
    }
  };

  const handleReject = async (patchId: string) => {
    await ideApi.rejectPatch(patchId);
    setProposals((prev) =>
      prev.map((p) => (p.patchId === patchId ? { ...p, status: 'rejected' } : p))
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '320px',
        background: '#0b1120',
        borderLeft: '1px solid #1e293b',
        color: '#e2e8f0',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          borderBottom: '1px solid #1e293b',
          fontSize: '12px',
          fontWeight: 700,
          color: '#38bdf8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <Sparkles size={16} />
        <span>Karma Coding Engine</span>
      </div>

      {/* Quick Action Chips */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '8px 12px',
          borderBottom: '1px solid #1e293b',
          background: '#090d16',
        }}
      >
        <button
          type="button"
          onClick={() => handleStartTask('', 'explain')}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#cbd5e1',
            borderRadius: '12px',
            padding: '3px 8px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Explain
        </button>
        <button
          type="button"
          onClick={() => handleStartTask('', 'fix')}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#cbd5e1',
            borderRadius: '12px',
            padding: '3px 8px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Fix Errors
        </button>
        <button
          type="button"
          onClick={() => handleStartTask('', 'refactor')}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#cbd5e1',
            borderRadius: '12px',
            padding: '3px 8px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Refactor
        </button>
        <button
          type="button"
          onClick={() => handleStartTask('', 'tests')}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#cbd5e1',
            borderRadius: '12px',
            padding: '3px 8px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Generate Tests
        </button>
      </div>

      {/* Chat Messages & Proposals */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              lineHeight: '1.45',
              background: m.role === 'user' ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
              border: `1px solid ${m.role === 'user' ? 'rgba(56, 189, 248, 0.4)' : '#1e293b'}`,
              color: '#f8fafc',
              whiteSpace: 'pre-wrap',
            }}
          >
            {m.text}
          </div>
        ))}

        {activity && (
          <div
            style={{
              fontSize: '11px',
              color: '#38bdf8',
              fontStyle: 'italic',
              padding: '6px',
              background: 'rgba(56, 189, 248, 0.08)',
              borderRadius: '4px',
            }}
          >
            ⏳ {activity}
          </div>
        )}

        {/* Patch Proposals Review */}
        {proposals.length > 0 && (
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
              Pending Patches ({proposals.length})
            </div>
            {proposals.map((p) => (
              <div
                key={p.patchId}
                style={{
                  background: '#040711',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '8px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8', marginBottom: '4px' }}>
                  {p.filePath}
                </div>
                <div
                  style={{
                    maxHeight: '120px',
                    overflowY: 'auto',
                    background: '#02040a',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    padding: '6px',
                    borderRadius: '4px',
                    color: '#e2e8f0',
                    whiteSpace: 'pre-wrap',
                    marginBottom: '8px',
                  }}
                >
                  {p.diff.slice(0, 1000)}
                </div>

                {p.status === 'applied' ? (
                  <div style={{ color: '#4ade80', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} /> Applied to workspace
                  </div>
                ) : p.status === 'rejected' ? (
                  <div style={{ color: '#ef4444', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <X size={14} /> Rejected
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleApply(p)}
                      style={{
                        flex: 1,
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        padding: '4px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Accept Patch
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(p.patchId)}
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleStartTask();
        }}
        style={{
          padding: '8px 12px',
          background: '#090d16',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          gap: '6px',
        }}
      >
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask or command coding agent..."
          disabled={isWorking}
          style={{
            flex: 1,
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#f8fafc',
            borderRadius: '4px',
            padding: '6px 8px',
            fontSize: '12px',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!prompt.trim() || isWorking}
          style={{
            background: prompt.trim() && !isWorking ? '#38bdf8' : '#334155',
            color: '#090d16',
            border: 'none',
            borderRadius: '4px',
            padding: '0 10px',
            cursor: prompt.trim() && !isWorking ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
