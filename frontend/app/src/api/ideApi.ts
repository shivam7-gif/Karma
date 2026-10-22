import { CONFIG } from '../config';
import type { WorkspaceFileNode, GitStatusFile } from '../types/ide';

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE = isLocal ? 'http://localhost:3000' : CONFIG.apiEndpoint.replace(/\/api\/chat$/, '');
const AUTH_HEADER = { 'Authorization': 'Bearer dev-user' };

export const ideApi = {
  async getTree(subPath = ''): Promise<{ root: string; tree: WorkspaceFileNode[] }> {
    const res = await fetch(`${API_BASE}/api/workspace/tree?path=${encodeURIComponent(subPath)}`, {
      headers: { ...AUTH_HEADER },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async readFile(filePath: string): Promise<{ path: string; relativePath: string; content: string; hash: string }> {
    const res = await fetch(`${API_BASE}/api/workspace/file?path=${encodeURIComponent(filePath)}`, {
      headers: { ...AUTH_HEADER },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async saveFile(filePath: string, content: string, expectedHash?: string): Promise<{ success: boolean; hash: string }> {
    const res = await fetch(`${API_BASE}/api/workspace/file`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content, expectedHash }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save file');
    }
    return res.json();
  },

  async createEntry(targetPath: string, type: 'file' | 'directory'): Promise<void> {
    const res = await fetch(`${API_BASE}/api/workspace/create`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: targetPath, type }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create entry');
    }
  },

  async renameEntry(oldPath: string, newPath: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/workspace/rename`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to rename entry');
    }
  },

  async deleteEntry(targetPath: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/workspace/delete`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: targetPath }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete entry');
    }
  },

  async getGitStatus(): Promise<{ branch: string; files: GitStatusFile[] }> {
    const res = await fetch(`${API_BASE}/api/workspace/git/status`, {
      headers: { ...AUTH_HEADER },
    });
    if (!res.ok) return { branch: 'main', files: [] };
    return res.json();
  },

  async getGitDiff(filePath?: string): Promise<string> {
    const q = filePath ? `?path=${encodeURIComponent(filePath)}` : '';
    const res = await fetch(`${API_BASE}/api/workspace/git/diff${q}`, {
      headers: { ...AUTH_HEADER },
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.diff || '';
  },

  async getRoot(): Promise<string> {
    const res = await fetch(`${API_BASE}/api/workspace/root`, {
      headers: { ...AUTH_HEADER },
    });
    const data = await res.json();
    return data.root;
  },

  async setRoot(newRoot: string): Promise<string> {
    const res = await fetch(`${API_BASE}/api/workspace/root`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: newRoot }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to switch workspace root');
    }
    const data = await res.json();
    return data.root;
  },

  async getPreviewPorts(): Promise<number[]> {
    const res = await fetch(`${API_BASE}/api/workspace/preview/ports`, {
      headers: { ...AUTH_HEADER },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.ports || [];
  },

  async runTerminalCommand(command: string): Promise<{ processId: string; command: string }> {
    const res = await fetch(`${API_BASE}/api/terminal/run`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to execute command');
    }
    return res.json();
  },

  async stopProcess(processId: string): Promise<void> {
    await fetch(`${API_BASE}/api/terminal/stop`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ processId }),
    });
  },

  async sendTerminalInput(processId: string, input: string): Promise<void> {
    await fetch(`${API_BASE}/api/terminal/input`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ processId, input }),
    });
  },

  streamTerminal(processId: string, onChunk: (chunk: { type: string; data: string }) => void): () => void {
    const es = new EventSource(`${API_BASE}/api/terminal/stream/${processId}`);
    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onChunk(parsed);
      } catch {}
    };
    return () => es.close();
  },

  async startCodingTask(payload: {
    prompt: string;
    actionType?: string;
    activeFile?: string;
    selectedText?: string;
  }): Promise<{ taskId: string }> {
    const res = await fetch(`${API_BASE}/api/vscode/task/start`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start coding task');
    }
    return res.json();
  },

  streamCodingTask(taskId: string, onEvent: (event: any) => void): () => void {
    const es = new EventSource(`${API_BASE}/api/vscode/task/stream/${taskId}`);
    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onEvent(parsed);
      } catch {}
    };
    return () => es.close();
  },

  async applyPatch(patchId: string): Promise<{ success: boolean; newHash: string }> {
    const res = await fetch(`${API_BASE}/api/vscode/patch/apply`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ patchId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to apply patch');
    }
    return res.json();
  },

  async rejectPatch(patchId: string): Promise<void> {
    await fetch(`${API_BASE}/api/vscode/patch/reject`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ patchId }),
    });
  },
};
