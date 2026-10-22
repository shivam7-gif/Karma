import { spawn, type ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as readline from 'node:readline';
import { createRequire } from 'node:module';
import {
  type OverlayState,
  type OverlayStatusUpdate,
  type OverlayStopEvent,
  type OverlayOutboundMessage,
  type ProductIntelligenceData,
  DEFAULT_STATUS_MESSAGES,
} from './types.js';

const require = createRequire(import.meta.url);

export class ScreenControlOverlay {
  private child: ChildProcess | null = null;
  private abortController: AbortController = new AbortController();
  private stopListeners: Array<(event: OverlayStopEvent) => void> = [];
  private isReady = false;
  private hasStopped = false;
  private exitHandler: (() => void) | null = null;

  public get abortSignal(): AbortSignal {
    return this.abortController.signal;
  }

  public get isAborted(): boolean {
    return this.abortController.signal.aborted;
  }

  public throwIfAborted(): void {
    if (this.isAborted) {
      throw new Error('Automation was cancelled by the user.');
    }
  }

  public onStop(callback: (event: OverlayStopEvent) => void): () => void {
    this.stopListeners.push(callback);
    return () => {
      this.stopListeners = this.stopListeners.filter((cb) => cb !== callback);
    };
  }

  public async start(): Promise<void> {
    if (this.child) return;

    return new Promise<void>((resolve, reject) => {
      try {
        let electronExe: string;
        try {
          electronExe = require('electron');
        } catch {
          electronExe = 'electron';
        }

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const mainScript = path.join(__dirname, 'electron-main.cjs');

        this.child = spawn(electronExe, [mainScript], {
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          env: {
            ...process.env,
            ELECTRON_ENABLE_LOGGING: '0',
          },
        });

        // Ensure child process is killed if parent node exits
        this.exitHandler = () => {
          this.closeSync();
        };
        process.on('exit', this.exitHandler);
        process.on('SIGINT', this.exitHandler);
        process.on('SIGTERM', this.exitHandler);

        const timeout = setTimeout(() => {
          if (!this.isReady) {
            console.warn('[Overlay] Timeout waiting for overlay window to report ready. Proceeding anyway.');
            resolve();
          }
        }, 6000);

        this.child.on('message', (msg: OverlayOutboundMessage) => {
          if (msg && typeof msg === 'object') {
            if (msg.type === 'ready') {
              this.isReady = true;
              clearTimeout(timeout);
              resolve();
            } else if (msg.type === 'stop') {
              this.triggerStop(msg);
            }
          }
        });

        if (this.child.stdout) {
          const rl = readline.createInterface({
            input: this.child.stdout,
            terminal: false,
          });

          rl.on('line', (line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            try {
              const msg = JSON.parse(trimmed) as OverlayOutboundMessage;
              if (msg.type === 'ready') {
                this.isReady = true;
                clearTimeout(timeout);
                resolve();
              } else if (msg.type === 'stop') {
                this.triggerStop(msg);
              }
            } catch {
              // Ignore non-json debug lines
            }
          });
        }

        this.child.on('error', (err) => {
          console.error('[Overlay] Electron process failed to spawn:', err);
          clearTimeout(timeout);
          reject(err);
        });

        this.child.on('exit', (_code) => {
          this.child = null;
          this.isReady = false;
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  public setStatus(
    state: OverlayState,
    action?: string | undefined,
    details?: string | undefined,
    intel?: ProductIntelligenceData | undefined
  ): void {
    if (!this.child) return;

    const actionText = action || DEFAULT_STATUS_MESSAGES[state] || state;
    const payload: OverlayStatusUpdate = {
      type: 'status',
      state,
      action: actionText,
      ...(details !== undefined ? { details } : {}),
      ...(intel !== undefined ? { intel } : {}),
    };

    if (typeof this.child.send === 'function' && this.child.connected) {
      try {
        this.child.send(payload);
        return;
      } catch {}
    }

    if (this.child.stdin && !this.child.stdin.destroyed) {
      try {
        this.child.stdin.write(JSON.stringify(payload) + '\n');
      } catch {}
    }
  }

  private triggerStop(event: OverlayStopEvent): void {
    if (this.hasStopped) return;
    this.hasStopped = true;

    if (!this.abortController.signal.aborted) {
      this.abortController.abort(new Error(`Stop requested via ${event.reason}`));
    }

    for (const listener of this.stopListeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('[Overlay] Error in stop listener:', e);
      }
    }
  }

  public async close(): Promise<void> {
    if (this.exitHandler) {
      process.removeListener('exit', this.exitHandler);
      process.removeListener('SIGINT', this.exitHandler);
      process.removeListener('SIGTERM', this.exitHandler);
      this.exitHandler = null;
    }

    if (!this.child) return;

    return new Promise<void>((resolve) => {
      const child = this.child;
      this.child = null;

      if (!child || child.killed) {
        resolve();
        return;
      }

      const forceKillTimeout = setTimeout(() => {
        try {
          if (!child.killed) child.kill('SIGKILL');
        } catch {}
        resolve();
      }, 1500);

      child.once('exit', () => {
        clearTimeout(forceKillTimeout);
        resolve();
      });

      try {
        if (child.stdin && !child.stdin.destroyed) {
          child.stdin.write(JSON.stringify({ type: 'close' }) + '\n');
          child.stdin.end();
        }
      } catch {
        child.kill();
      }
    });
  }

  private closeSync(): void {
    if (this.child && !this.child.killed) {
      try {
        this.child.kill('SIGKILL');
      } catch {}
      this.child = null;
    }
  }
}
