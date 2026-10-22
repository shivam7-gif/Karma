import * as vscode from 'vscode';
import { KarmaClient, PatchProposal, TaskStreamEvent } from '../karmaClient';

export class KarmaChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _client: KarmaClient,
    private readonly _onApplyPatch: (patch: PatchProposal) => Promise<void>
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'connect':
          vscode.commands.executeCommand('karma.connect');
          break;
        case 'disconnect':
          vscode.commands.executeCommand('karma.disconnect');
          break;
        case 'sendPrompt':
          this.handleSendPrompt(data.prompt, data.actionType);
          break;
        case 'applyPatch':
          if (data.patch) {
            await this._onApplyPatch(data.patch);
          }
          break;
        case 'rejectPatch':
          if (data.patchId) {
            await this._client.rejectPatch(data.patchId);
            this.postMessage({ type: 'patchRejected', patchId: data.patchId });
          }
          break;
        case 'openIde':
          vscode.commands.executeCommand('karma.openInKarmaIde');
          break;
      }
    });
  }

  public postMessage(message: unknown) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  public setConnectionState(connected: boolean, workspaceInfo?: any) {
    this.postMessage({
      type: 'connectionStatus',
      connected,
      workspaceInfo,
    });
  }

  public async handleSendPrompt(prompt: string, actionType?: string) {
    if (!this._client.isConnected()) {
      vscode.window.showWarningMessage('Please connect to Karma Assistant first.');
      return;
    }

    const editor = vscode.window.activeTextEditor;
    let activeFile: string | undefined;
    let selectedText: string | undefined;

    if (editor) {
      activeFile = vscode.workspace.asRelativePath(editor.document.uri);
      selectedText = editor.document.getText(editor.selection);
    }

    this.postMessage({
      type: 'taskStarted',
      prompt,
      actionType,
    });

    try {
      const { taskId } = await this._client.startTask({
        prompt,
        actionType: actionType as any,
        activeFile,
        selectedText,
      });

      this._client.streamTask(
        taskId,
        (event: TaskStreamEvent) => {
          this.postMessage({
            type: 'streamEvent',
            event,
          });
        },
        (err: Error) => {
          this.postMessage({
            type: 'streamError',
            error: err.message,
          });
        }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.postMessage({
        type: 'streamError',
        error: msg,
      });
    }
  }

  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      margin: 0;
      padding: 12px;
      display: flex;
      flex-direction: column;
      height: 100vh;
      box-sizing: border-box;
    }
    .status-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-radius: 6px;
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-widget-border, #333);
      margin-bottom: 12px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #888;
    }
    .dot.online { background: #10b981; }
    .btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
    }
    .btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 10px;
    }
    .chip {
      background: var(--vscode-badge-background, #2d2d2d);
      color: var(--vscode-badge-foreground, #ccc);
      border: 1px solid var(--vscode-widget-border, #444);
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      cursor: pointer;
    }
    .chip:hover {
      border-color: var(--vscode-focusBorder);
      color: #fff;
    }
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 12px;
    }
    .msg {
      padding: 8px 10px;
      border-radius: 6px;
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-widget-border, #333);
      font-size: 12px;
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .msg.user {
      border-color: var(--vscode-focusBorder, #007acc);
      background: rgba(0, 122, 204, 0.1);
    }
    .progress-bar {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      padding: 4px;
    }
    .patch-box {
      margin-top: 8px;
      padding: 8px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 4px;
    }
    .patch-header {
      font-weight: bold;
      margin-bottom: 6px;
      color: #38bdf8;
    }
    .patch-diff {
      background: #111;
      color: #eee;
      font-family: monospace;
      font-size: 11px;
      padding: 6px;
      border-radius: 4px;
      overflow-x: auto;
      max-height: 150px;
      white-space: pre;
    }
    .patch-actions {
      display: flex;
      gap: 8px;
      margin-top: 6px;
    }
    .input-box {
      display: flex;
      gap: 6px;
    }
    textarea {
      flex: 1;
      height: 48px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 6px;
      resize: none;
      font-family: inherit;
    }
    textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
  </style>
</head>
<body>
  <div class="status-card">
    <div class="badge">
      <span id="dot" class="dot"></span>
      <span id="status-text">Disconnected</span>
    </div>
    <div>
      <button id="conn-btn" class="btn">Connect</button>
      <button id="ide-btn" class="btn" style="margin-left:4px;">Open IDE</button>
    </div>
  </div>

  <div class="quick-actions">
    <div class="chip" data-action="explain">Explain</div>
    <div class="chip" data-action="fix">Fix Error</div>
    <div class="chip" data-action="refactor">Refactor</div>
    <div class="chip" data-action="tests">Generate Tests</div>
    <div class="chip" data-action="review">Review Changes</div>
  </div>

  <div id="messages" class="chat-messages">
    <div class="msg">Welcome to Karma Coding Assistant. Select code or type a task below to begin.</div>
  </div>

  <div class="input-box">
    <textarea id="prompt-input" placeholder="Describe task or ask Karma..."></textarea>
    <button id="send-btn" class="btn" style="height:48px;">Send</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let isConnected = false;
    let pendingPatches = {};

    const dot = document.getElementById('dot');
    const statusText = document.getElementById('status-text');
    const connBtn = document.getElementById('conn-btn');
    const ideBtn = document.getElementById('ide-btn');
    const messages = document.getElementById('messages');
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');

    connBtn.addEventListener('click', () => {
      if (isConnected) {
        vscode.postMessage({ type: 'disconnect' });
      } else {
        vscode.postMessage({ type: 'connect' });
      }
    });

    ideBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'openIde' });
    });

    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const action = chip.getAttribute('data-action');
        vscode.postMessage({ type: 'sendPrompt', prompt: '', actionType: action });
      });
    });

    sendBtn.addEventListener('click', () => {
      const text = promptInput.value.trim();
      if (!text) return;
      promptInput.value = '';
      appendMessage('user', text);
      vscode.postMessage({ type: 'sendPrompt', prompt: text });
    });

    function appendMessage(role, text) {
      const el = document.createElement('div');
      el.className = 'msg ' + (role || '');
      el.textContent = text;
      messages.appendChild(el);
      messages.scrollTop = messages.scrollHeight;
      return el;
    }

    let currentProgressEl = null;

    window.addEventListener('message', event => {
      const msg = event.data;
      switch (msg.type) {
        case 'connectionStatus':
          isConnected = msg.connected;
          if (isConnected) {
            dot.className = 'dot online';
            statusText.textContent = msg.workspaceInfo?.projectName || 'Connected';
            connBtn.textContent = 'Disconnect';
          } else {
            dot.className = 'dot';
            statusText.textContent = 'Disconnected';
            connBtn.textContent = 'Connect';
          }
          break;

        case 'taskStarted':
          currentProgressEl = document.createElement('div');
          currentProgressEl.className = 'progress-bar';
          currentProgressEl.textContent = 'Karma: Starting task...';
          messages.appendChild(currentProgressEl);
          messages.scrollTop = messages.scrollHeight;
          break;

        case 'streamEvent':
          if (msg.event.type === 'progress') {
            if (currentProgressEl) {
              currentProgressEl.textContent = '⏳ ' + msg.event.message;
            }
          } else if (msg.event.type === 'done') {
            if (currentProgressEl) currentProgressEl.remove();
            const doneMsg = appendMessage('bot', msg.event.plan || 'Task completed.');

            if (msg.event.proposals && msg.event.proposals.length > 0) {
              msg.event.proposals.forEach(patch => {
                pendingPatches[patch.patchId] = patch;
                renderPatch(patch);
              });
            }
          }
          break;

        case 'streamError':
          if (currentProgressEl) currentProgressEl.remove();
          appendMessage('bot', 'Error: ' + msg.error);
          break;

        case 'patchRejected':
          const pEl = document.getElementById('patch-' + msg.patchId);
          if (pEl) pEl.innerHTML = '<span style="color:#ef4444;">Patch rejected</span>';
          break;
      }
    });

    function renderPatch(patch) {
      const box = document.createElement('div');
      box.className = 'patch-box';
      box.id = 'patch-' + patch.patchId;

      box.innerHTML = \`
        <div class="patch-header">Proposed Change: \${patch.filePath}</div>
        <div class="patch-diff">\${patch.diff.slice(0, 1000)}</div>
        <div class="patch-actions">
          <button class="btn" style="background:#10b981;" onclick="applyPatch('\${patch.patchId}')">Accept Patch</button>
          <button class="btn" style="background:#ef4444;" onclick="rejectPatch('\${patch.patchId}')">Reject</button>
        </div>
      \`;
      messages.appendChild(box);
      messages.scrollTop = messages.scrollHeight;
    }

    window.applyPatch = function(patchId) {
      const patch = pendingPatches[patchId];
      if (patch) {
        vscode.postMessage({ type: 'applyPatch', patch });
        const pEl = document.getElementById('patch-' + patchId);
        if (pEl) pEl.innerHTML = '<span style="color:#10b981;">Patch applied successfully.</span>';
      }
    };

    window.rejectPatch = function(patchId) {
      vscode.postMessage({ type: 'rejectPatch', patchId });
    };
  </script>
</body>
</html>`;
  }
}
