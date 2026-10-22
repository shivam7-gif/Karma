import React, { useEffect, useState } from 'react';
import { X, Key, Check, AlertCircle, RefreshCw, Trash2, Cpu, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../store/appStore';

interface ModelOption {
  id: string;
  name: string;
  contextLength: number;
  isFree: boolean;
  supportsTools: boolean;
}

interface SettingsData {
  hasKey: boolean;
  keyMask?: string | null;
  keyLast4?: string | null;
  defaultModel: string;
  fallbackModels: string[];
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAppStore();
  const userId = user?.email || 'default-user';

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        headers: { 'x-user-id': userId },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.warn('Failed to fetch settings from backend:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/models`, {
        headers: { 'x-user-id': userId },
      });
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || []);
      }
    } catch (err) {
      console.warn('Failed to fetch models:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      fetchModels();
      setTestResult(null);
      setStatusMessage(null);
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    if (!apiKeyInput.trim()) {
      setStatusMessage('Please enter an API key to test.');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    setStatusMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/settings/llm-key/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ valid: data.valid, message: data.message });
      } else {
        setTestResult({ valid: false, message: data.error || 'Key validation failed' });
      }
    } catch (err: any) {
      setTestResult({ valid: false, message: err.message || 'Network error' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) return;
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/settings/llm-key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });

      if (res.ok) {
        setStatusMessage('API Key securely saved and encrypted.');
        setApiKeyInput('');
        await fetchSettings();
        await fetchModels();
      } else {
        const data = await res.json();
        setStatusMessage(`Error: ${data.error || 'Failed to save key'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message || 'Network error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!confirm('Are you sure you want to remove your OpenRouter API key?')) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/llm-key`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId },
      });
      if (res.ok) {
        setStatusMessage('API Key removed.');
        await fetchSettings();
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message || 'Failed to remove key'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelChange = async (newModel: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ defaultModel: newModel }),
      });
      if (res.ok) {
        setSettings((prev) => (prev ? { ...prev, defaultModel: newModel } : prev));
      }
    } catch (err) {
      console.warn('Failed to update default model:', err);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(25, 22, 29, 0.45)',
        backdropFilter: 'blur(8px)',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid var(--border-glass, #e7e2d8)',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid #f0eee8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--accent-soft, rgba(139, 61, 255, 0.08))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent, #8b3dff)',
              }}
            >
              <Key size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#19161d' }}>
                AI Engine & Settings
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#8e8798' }}>
                OpenRouter BYOK (Bring Your Own Key) & Models
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#8e8798',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Key Status Pill */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: settings?.hasKey ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${settings?.hasKey ? '#bbf7d0' : '#fde68a'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {settings?.hasKey ? (
                <ShieldCheck size={20} color="#16a34a" />
              ) : (
                <AlertCircle size={20} color="#d97706" />
              )}
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: settings?.hasKey ? '#166534' : '#92400e' }}>
                  {settings?.hasKey ? 'Key Configured' : 'No Personal Key Stored'}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: settings?.hasKey ? '#15803d' : '#b45309' }}>
                  {settings?.hasKey
                    ? `Encrypted at rest: ${settings.keyMask || (settings.keyLast4 ? `••••••••${settings.keyLast4}` : 'Saved')}`
                    : 'Add your free OpenRouter API key for high rate limits.'}
                </p>
              </div>
            </div>
            {settings?.hasKey && (
              <button
                type="button"
                onClick={handleDeleteKey}
                disabled={isLoading}
                title="Remove saved key"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                }}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {/* Key Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
              {settings?.hasKey ? 'Replace OpenRouter API Key' : 'Enter OpenRouter API Key'}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="password"
                placeholder="sk-or-v1-..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #d1d5db',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleTestKey}
                disabled={isTesting || !apiKeyInput.trim()}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '1px solid #d1d5db',
                  background: '#f9fafb',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: isTesting || !apiKeyInput.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#374151',
                }}
              >
                {isTesting ? <RefreshCw size={14} className="spin" /> : 'Test'}
              </button>
              <button
                type="button"
                onClick={handleSaveKey}
                disabled={isLoading || !apiKeyInput.trim()}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--accent, #8b3dff)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: isLoading || !apiKeyInput.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                Save
              </button>
            </div>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>
              Get a key for free at{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent, #8b3dff)', textDecoration: 'underline' }}
              >
                openrouter.ai/keys
              </a>
              . Your key is encrypted with AES-256-GCM before storage and never returned in plaintext.
            </span>
          </div>

          {/* Test Result Feedback */}
          {testResult && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: testResult.valid ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${testResult.valid ? '#bbf7d0' : '#fecaca'}`,
                fontSize: '12px',
                color: testResult.valid ? '#166534' : '#991b1b',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {testResult.valid ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}

          {statusMessage && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: '#f3f4f6',
                fontSize: '12px',
                color: '#374151',
              }}
            >
              {statusMessage}
            </div>
          )}

          {/* Default Model Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={15} color="var(--accent, #8b3dff)" />
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
                Default Model
              </label>
            </div>
            <select
              value={settings?.defaultModel || 'meta-llama/llama-3.3-70b-instruct:free'}
              onChange={(e) => handleModelChange(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                background: '#ffffff',
                outline: 'none',
              }}
            >
              {models.length > 0 ? (
                models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id} {m.isFree ? '(Free)' : ''}
                  </option>
                ))
              ) : (
                <>
                  <option value="meta-llama/llama-3.3-70b-instruct:free">
                    Llama 3.3 70B Instruct (Free)
                  </option>
                  <option value="google/gemini-2.0-flash-exp:free">
                    Gemini 2.0 Flash Exp (Free)
                  </option>
                  <option value="qwen/qwen-2.5-72b-instruct:free">
                    Qwen 2.5 72B Instruct (Free)
                  </option>
                </>
              )}
            </select>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>
              If your chosen model hits a rate limit, Karma automatically switches down the fallback chain.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            background: '#faf9f7',
            borderTop: '1px solid #f0eee8',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: '#ffffff',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
