import React, { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw, Smartphone, Tablet, Monitor } from 'lucide-react';
import { ideApi } from '../../api/ideApi';

export const LivePreview: React.FC = () => {
  const [ports, setPorts] = useState<number[]>([]);
  const [selectedPort, setSelectedPort] = useState<number>(5173);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [key, setKey] = useState(0);

  const checkPorts = async () => {
    try {
      const active = await ideApi.getPreviewPorts();
      setPorts(active);
      if (active.length > 0 && !active.includes(selectedPort)) {
        setSelectedPort(active[0]);
      }
    } catch {}
  };

  useEffect(() => {
    checkPorts();
    const interval = setInterval(checkPorts, 5000);
    return () => clearInterval(interval);
  }, []);

  const previewUrl = `http://localhost:${selectedPort}`;

  const getViewportWidth = () => {
    switch (viewport) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      default:
        return '100%';
    }
  };

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
      {/* Preview Nav Header */}
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
          <span style={{ fontWeight: 600, color: '#38bdf8' }}>Preview</span>
          <select
            value={selectedPort}
            onChange={(e) => setSelectedPort(Number(e.target.value))}
            style={{
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              outline: 'none',
            }}
          >
            {ports.length === 0 ? (
              <option value={selectedPort}>Port {selectedPort} (Offline)</option>
            ) : (
              ports.map((p) => (
                <option key={p} value={p}>
                  Port {p} (Active)
                </option>
              ))
            )}
          </select>
        </div>

        {/* Viewport Toggles & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', background: '#1e293b', borderRadius: '4px', padding: '2px' }}>
            <button
              type="button"
              onClick={() => setViewport('desktop')}
              style={{
                background: viewport === 'desktop' ? '#334155' : 'transparent',
                border: 'none',
                color: viewport === 'desktop' ? '#38bdf8' : '#94a3b8',
                padding: '3px 6px',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
              title="Desktop View"
            >
              <Monitor size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewport('tablet')}
              style={{
                background: viewport === 'tablet' ? '#334155' : 'transparent',
                border: 'none',
                color: viewport === 'tablet' ? '#38bdf8' : '#94a3b8',
                padding: '3px 6px',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
              title="Tablet View"
            >
              <Tablet size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewport('mobile')}
              style={{
                background: viewport === 'mobile' ? '#334155' : 'transparent',
                border: 'none',
                color: viewport === 'mobile' ? '#38bdf8' : '#94a3b8',
                padding: '3px 6px',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
              title="Mobile View"
            >
              <Smartphone size={14} />
            </button>
          </div>

          <button
            type="button"
            title="Reload Preview"
            onClick={() => setKey((k) => k + 1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
          >
            <RefreshCw size={14} />
          </button>

          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new window"
            style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Frame Container */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#040711',
          padding: '8px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: getViewportWidth(),
            height: '100%',
            background: '#ffffff',
            borderRadius: viewport !== 'desktop' ? '8px' : '0',
            overflow: 'hidden',
            boxShadow: viewport !== 'desktop' ? '0 10px 25px rgba(0,0,0,0.5)' : 'none',
            transition: 'width 0.2s ease',
          }}
        >
          <iframe
            key={key}
            src={previewUrl}
            title="App Live Preview"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      </div>
    </div>
  );
};
