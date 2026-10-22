import React, { useState, useEffect } from 'react';
import { GitBranch, RefreshCw } from 'lucide-react';
import { ideApi } from '../../api/ideApi';
import type { GitStatusFile } from '../../types/ide';

export const GitDiffViewer: React.FC = () => {
  const [branch, setBranch] = useState('main');
  const [files, setFiles] = useState<GitStatusFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const loadGit = async () => {
    setLoading(true);
    try {
      const res = await ideApi.getGitStatus();
      setBranch(res.branch);
      setFiles(res.files);
      if (res.files.length > 0 && !selectedFile) {
        setSelectedFile(res.files[0].file);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGit();
  }, []);

  useEffect(() => {
    if (selectedFile) {
      ideApi.getGitDiff(selectedFile).then((d) => setDiff(d));
    } else {
      ideApi.getGitDiff().then((d) => setDiff(d));
    }
  }, [selectedFile]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#090d16',
        color: '#e2e8f0',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitBranch size={14} color="#38bdf8" />
          <span style={{ fontWeight: 600 }}>Branch:</span>
          <span style={{ color: '#38bdf8' }}>{branch}</span>
        </div>
        <button
          type="button"
          onClick={loadGit}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Changed Files List */}
        <div
          style={{
            width: '200px',
            borderRight: '1px solid #1e293b',
            overflowY: 'auto',
            padding: '8px',
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
            CHANGED FILES ({files.length})
          </div>
          {files.length === 0 ? (
            <div style={{ fontSize: '11px', color: '#64748b' }}>Working tree clean</div>
          ) : (
            files.map((f) => (
              <div
                key={f.file}
                onClick={() => setSelectedFile(f.file)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  background: selectedFile === f.file ? '#1e293b' : 'transparent',
                  color: selectedFile === f.file ? '#38bdf8' : '#cbd5e1',
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: f.status.includes('M') ? '#eab308' : '#22c55e',
                  }}
                >
                  {f.status}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.file}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Diff Content View */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '10px',
            fontFamily: "'Fira Code', monospace",
            fontSize: '12px',
            lineHeight: '1.4',
            background: '#040711',
          }}
        >
          {diff ? (
            diff.split('\n').map((line, idx) => {
              let color = '#cbd5e1';
              let bg = 'transparent';
              if (line.startsWith('+') && !line.startsWith('+++')) {
                color = '#4ade80';
                bg = 'rgba(74, 222, 128, 0.1)';
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                color = '#f87171';
                bg = 'rgba(248, 113, 113, 0.1)';
              } else if (line.startsWith('@@')) {
                color = '#38bdf8';
              }
              return (
                <div key={idx} style={{ color, background: bg, padding: '1px 4px' }}>
                  {line || ' '}
                </div>
              );
            })
          ) : (
            <div style={{ color: '#64748b' }}>No diff selected or no modifications.</div>
          )}
        </div>
      </div>
    </div>
  );
};
