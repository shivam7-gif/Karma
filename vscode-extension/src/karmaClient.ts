import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

export interface HandshakeResponse {
  protocolVersion: string;
  sessionId: string;
  status: string;
  serverTime: string;
  workspace: {
    root: string;
    projectName: string;
    stack: string[];
    scripts: Record<string, string>;
  };
  capabilities: string[];
}

export interface PatchProposal {
  patchId: string;
  taskId: string;
  filePath: string;
  description: string;
  originalHash: string;
  originalContent: string;
  proposedContent: string;
  diff: string;
  status: 'pending' | 'applied' | 'rejected';
  createdAt: string;
}

export interface TaskStreamEvent {
  type: 'progress' | 'done' | 'error';
  message?: string;
  taskId?: string;
  plan?: string;
  proposals?: PatchProposal[];
  reviewerNotes?: string;
  testPassed?: boolean;
  testOutput?: string;
  error?: string;
}

export class KarmaClient {
  private serverUrl: string;
  private authToken: string;
  private sessionId: string | null = null;
  private connected: boolean = false;

  constructor(serverUrl: string = 'http://localhost:3000', authToken: string = 'dev-user') {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.authToken = authToken;
  }

  public updateConfig(serverUrl: string, authToken: string) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.authToken = authToken;
  }

  public isConnected(): boolean {
    return this.connected && this.sessionId !== null;
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  private async request<T>(endpoint: string, method: string = 'GET', data?: unknown): Promise<T> {
    const parsed = new URL(`${this.serverUrl}${endpoint}`);
    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;

    const bodyString = data ? JSON.stringify(data) : undefined;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.authToken}`,
      'Accept': 'application/json',
    };
    if (bodyString) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyString).toString();
    }

    return new Promise((resolve, reject) => {
      const req = client.request(
        parsed,
        {
          method,
          headers,
          timeout: 10000,
        },
        (res) => {
          let responseData = '';
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          res.on('end', () => {
            try {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                const parsedData = responseData ? JSON.parse(responseData) : {};
                resolve(parsedData as T);
              } else {
                reject(new Error(`Server error (${res.statusCode}): ${responseData || res.statusMessage}`));
              }
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              reject(new Error(`Failed to parse response: ${msg}`));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Karma connection timed out'));
      });

      req.on('error', (err) => {
        reject(new Error(`Network error connecting to Karma: ${err.message}`));
      });

      if (bodyString) {
        req.write(bodyString);
      }
      req.end();
    });
  }

  public async handshake(workspaceRoot?: string): Promise<HandshakeResponse> {
    const res = await this.request<HandshakeResponse>('/api/vscode/handshake', 'POST', {
      clientVersion: '1.0.0',
      clientName: 'karma-vscode-extension',
      workspaceRoot,
    });
    this.sessionId = res.sessionId;
    this.connected = true;
    return res;
  }

  public disconnect() {
    this.sessionId = null;
    this.connected = false;
  }

  public async syncContext(activeFile?: string, selectedText?: string, diagnostics?: unknown[]): Promise<void> {
    if (!this.isConnected()) return;
    await this.request('/api/vscode/context/sync', 'POST', {
      sessionId: this.sessionId,
      activeFile,
      selectedText,
      diagnostics,
    });
  }

  public async startTask(payload: {
    prompt?: string;
    actionType?: 'explain' | 'fix' | 'refactor' | 'tests' | 'review';
    activeFile?: string;
    selectedText?: string;
    diagnostics?: unknown[];
    autoRunTests?: boolean;
  }): Promise<{ taskId: string; streamUrl: string }> {
    return await this.request<{ taskId: string; streamUrl: string }>(
      '/api/vscode/task/start',
      'POST',
      payload
    );
  }

  public streamTask(taskId: string, onEvent: (event: TaskStreamEvent) => void, onError: (err: Error) => void) {
    const parsed = new URL(`${this.serverUrl}/api/vscode/task/stream/${taskId}`);
    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(
      parsed,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Accept': 'text/event-stream',
        },
      },
      (res) => {
        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              try {
                const json = JSON.parse(trimmed.replace(/^data:\s*/, ''));
                onEvent(json);
              } catch (e) {
                // Ignore parsing of partial data lines
              }
            }
          }
        });

        res.on('end', () => {
          // Stream ended
        });
      }
    );

    req.on('error', (err) => {
      onError(err);
    });

    req.end();
  }

  public async applyPatch(patchId: string): Promise<{ success: boolean; patchId: string; newHash: string }> {
    return await this.request('/api/vscode/patch/apply', 'POST', { patchId });
  }

  public async rejectPatch(patchId: string): Promise<{ success: boolean }> {
    return await this.request('/api/vscode/patch/reject', 'POST', { patchId });
  }

  public async reportDiagnostics(diagnostics: unknown[], testResults?: unknown): Promise<void> {
    if (!this.isConnected()) return;
    await this.request('/api/vscode/diagnostics/report', 'POST', {
      sessionId: this.sessionId,
      diagnostics,
      testResults,
    });
  }
}
