import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { workspaceService } from './workspaceService.js';
import { logger } from '../lib/logger.js';

export interface RunningProcess {
  processId: string;
  command: string;
  args: string[];
  startTime: string;
  exitCode: number | null;
  outputBuffer: string[];
  child: ChildProcess;
  listeners: Array<(chunk: { type: 'stdout' | 'stderr' | 'exit'; data: string }) => void>;
}

const ALLOWED_CMD_PREFIXES = ['npm', 'npx', 'node', 'git', 'pnpm', 'yarn', 'python', 'pip', 'cargo'];

export class TerminalService {
  private processes: Map<string, RunningProcess> = new Map();

  isCommandAllowed(command: string): boolean {
    const trimmed = command.trim();
    const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase() || '';
    return ALLOWED_CMD_PREFIXES.includes(firstWord);
  }

  startProcess(rawCommand: string, options?: { cwd?: string; env?: Record<string, string> }): RunningProcess {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Integrated terminal execution is disabled in production.');
    }

    const trimmed = rawCommand.trim();
    if (!this.isCommandAllowed(trimmed)) {
      throw new Error(`Security Policy: Execution of command '${trimmed.split(' ')[0]}' is not permitted in sandbox.`);
    }

    const processId = `proc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const cwd = options?.cwd || workspaceService.getRoot();

    const isWin = process.platform === 'win32';
    const child = spawn(trimmed, [], {
      cwd,
      shell: true,
      env: { ...process.env, ...options?.env },
    });

    const procRecord: RunningProcess = {
      processId,
      command: trimmed,
      args: [trimmed],
      startTime: new Date().toISOString(),
      exitCode: null,
      outputBuffer: [],
      child,
      listeners: [],
    };

    const broadcast = (type: 'stdout' | 'stderr' | 'exit', data: string) => {
      procRecord.outputBuffer.push(`[${type}] ${data}`);
      if (procRecord.outputBuffer.length > 500) {
        procRecord.outputBuffer.shift();
      }
      for (const listener of procRecord.listeners) {
        try {
          listener({ type, data });
        } catch {}
      }
    };

    child.stdout?.on('data', (d: Buffer) => {
      broadcast('stdout', d.toString());
    });

    child.stderr?.on('data', (d: Buffer) => {
      broadcast('stderr', d.toString());
    });

    child.on('close', (code: number | null) => {
      procRecord.exitCode = code;
      broadcast('exit', `Process exited with code ${code}`);
      logger.info({ processId, command: trimmed, code }, 'Process terminated');
    });

    child.on('error', (err: Error) => {
      broadcast('stderr', `Process error: ${err.message}`);
    });

    this.processes.set(processId, procRecord);
    return procRecord;
  }

  getProcess(processId: string): RunningProcess | null {
    return this.processes.get(processId) || null;
  }

  listProcesses(): Array<Omit<RunningProcess, 'child' | 'listeners'>> {
    return Array.from(this.processes.values()).map((p) => ({
      processId: p.processId,
      command: p.command,
      args: p.args,
      startTime: p.startTime,
      exitCode: p.exitCode,
      outputBuffer: p.outputBuffer.slice(-20),
    }));
  }

  sendInput(processId: string, input: string): boolean {
    const p = this.processes.get(processId);
    if (!p || p.exitCode !== null) return false;
    p.child.stdin?.write(input);
    return true;
  }

  stopProcess(processId: string): boolean {
    const p = this.processes.get(processId);
    if (!p || p.exitCode !== null) return false;
    p.child.kill();
    p.exitCode = -1;
    return true;
  }

  async detectLivePorts(candidates = [5173, 3000, 4000, 8080, 8000]): Promise<number[]> {
    const active: number[] = [];
    const checkPort = (port: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(300);
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        socket.on('error', () => {
          socket.destroy();
          resolve(false);
        });
        socket.connect(port, '127.0.0.1');
      });
    };

    for (const port of candidates) {
      const isUp = await checkPort(port);
      if (isUp) active.push(port);
    }
    return active;
  }
}

export const terminalService = new TerminalService();
