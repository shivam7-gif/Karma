import React, { useState, useEffect, useRef } from 'react';
import { Square, Terminal as TerminalIcon, Trash2 } from 'lucide-react';
import { ideApi } from '../../api/ideApi';

interface TerminalPanelProps {
  onProcessStarted?: (processId: string) => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ onProcessStarted }) => {
  const [command, setCommand] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const handleRun = async (cmdToRun?: string) => {
    const cmd = (cmdToRun || command).trim();
    if (!cmd) return;

    if (stopStreamRef.current) {
      stopStreamRef.current();
      stopStreamRef.current = null;
    }

    setLines((prev) => [...prev, `$ ${cmd}`]);
    setCommand('');
    setIsRunning(true);

    try {
      const res = await ideApi.runTerminalCommand(cmd);
      setActiveProcessId(res.processId);
      onProcessStarted?.(res.processId);

      const closeStream = ideApi.streamTerminal(res.processId, (chunk) => {
        setLines((prev) => [...prev, chunk.data]);
        if (chunk.type === 'exit') {
          setIsRunning(false);
        }
      });
      stopStreamRef.current = closeStream;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLines((prev) => [...prev, `Error: ${msg}`]);
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    if (!activeProcessId) return;
    try {
      await ideApi.stopProcess(activeProcessId);
      setLines((prev) => [...prev, '[Process Terminated by User]']);
      setIsRunning(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLines((prev) => [...prev, `Failed to stop: ${msg}`]);
    }
  };

  const handleClear = () => {
    setLines([]);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#090d16',
        color: '#e2e8f0',
        fontFamily: "'Fira Code', 'Cascadia Code', monospace",
        fontSize: '12px',
      }}
    >
      {/* Control Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TerminalIcon size={14} color="#38bdf8" />
          <span style={{ fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Terminal</span>
          {isRunning ? (
            <span
              style={{
                fontSize: '10px',
                background: '#10b981',
                color: '#fff',
                padding: '1px 6px',
                borderRadius: '8px',
              }}
            >
              RUNNING
            </span>
          ) : (
            <span style={{ fontSize: '10px', color: '#64748b' }}>IDLE</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => handleRun('npm test')}
            style={{
              background: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              padding: '3px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Run Tests
          </button>
          <button
            type="button"
            onClick={() => handleRun('npm run dev')}
            style={{
              background: '#1e293b',
              color: '#38bdf8',
              border: '1px solid #334155',
              padding: '3px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Start Dev Server
          </button>
          {isRunning && (
            <button
              type="button"
              onClick={handleStop}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                padding: '3px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Square size={10} fill="#fff" /> Stop
            </button>
          )}
          <button
            type="button"
            title="Clear terminal"
            onClick={handleClear}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div
        style={{
          flex: 1,
          padding: '10px',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          lineHeight: '1.45',
        }}
      >
        {lines.length === 0 ? (
          <div style={{ color: '#64748b' }}>Integrated Sandbox Terminal. Ready for commands.</div>
        ) : (
          lines.map((l, i) => <div key={i}>{l}</div>)
        )}
        <div ref={outputEndRef} />
      </div>

      {/* Terminal Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleRun();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 12px',
          background: '#090d16',
          borderTop: '1px solid #1e293b',
          gap: '8px',
        }}
      >
        <span style={{ color: '#38bdf8' }}>$</span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Enter command (e.g., npm run build, npx vitest)..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#f8fafc',
            outline: 'none',
            fontFamily: 'inherit',
            fontSize: '12px',
          }}
        />
        <button
          type="submit"
          disabled={!command.trim()}
          style={{
            background: command.trim() ? '#38bdf8' : '#334155',
            color: '#090d16',
            border: 'none',
            padding: '4px 10px',
            borderRadius: '4px',
            cursor: command.trim() ? 'pointer' : 'default',
            fontWeight: 600,
            fontSize: '11px',
          }}
        >
          Execute
        </button>
      </form>
    </div>
  );
};
