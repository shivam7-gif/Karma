import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../lib/logger.js';
import { lockManager } from '../agent/orchestrator/lockManager.js';

const execAsync = promisify(exec);

export interface FileNode {
  name: string;
  path: string;
  relativePath: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
  children?: FileNode[];
}

export interface WorkspaceFileContent {
  path: string;
  relativePath: string;
  content: string;
  hash: string;
  modifiedAt: string;
}

export class WorkspaceService {
  private currentRoot: string;

  constructor(initialRoot?: string) {
    this.currentRoot = initialRoot ? path.resolve(initialRoot) : path.resolve(process.cwd(), '..');
    if (!fs.existsSync(this.currentRoot)) {
      this.currentRoot = process.cwd();
    }
  }

  getRoot(): string {
    return this.currentRoot;
  }

  setRoot(newRoot: string): boolean {
    const resolved = path.resolve(newRoot);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      this.currentRoot = resolved;
      logger.info({ root: this.currentRoot }, 'Workspace root updated');
      return true;
    }
    return false;
  }

  isPathSafe(targetPath: string): boolean {
    const resolved = path.resolve(this.currentRoot, targetPath);
    return resolved.startsWith(this.currentRoot);
  }

  getSafeFullPath(userPath: string): string {
    const resolved = path.resolve(this.currentRoot, userPath);
    if (!resolved.startsWith(this.currentRoot)) {
      throw new Error(`Access Denied: Path escapes workspace root: ${userPath}`);
    }
    return resolved;
  }

  computeHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
  }

  getTree(subPath = '', maxDepth = 4, currentDepth = 0): FileNode[] {
    const fullPath = this.getSafeFullPath(subPath);
    if (!fs.existsSync(fullPath)) return [];

    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) return [];

    if (currentDepth >= maxDepth) return [];

    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    const IGNORED_NAMES = new Set([
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      '.gemini',
      '.vscode',
      'coverage',
      '.turbo',
    ]);

    for (const entry of entries) {
      if (IGNORED_NAMES.has(entry.name) || entry.name.startsWith('.DS_Store')) {
        continue;
      }

      const entryFullPath = path.join(fullPath, entry.name);
      const relativePath = path.relative(this.currentRoot, entryFullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: entryFullPath,
          relativePath,
          type: 'directory',
          children: this.getTree(relativePath, maxDepth, currentDepth + 1),
        });
      } else {
        const ext = path.extname(entry.name).replace(/^\./, '');
        let size = 0;
        try {
          size = fs.statSync(entryFullPath).size;
        } catch {}

        nodes.push({
          name: entry.name,
          path: entryFullPath,
          relativePath,
          type: 'file',
          size,
          extension: ext,
        });
      }
    }

    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return nodes;
  }

  async readFile(filePath: string): Promise<WorkspaceFileContent> {
    const fullPath = this.getSafeFullPath(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await fs.promises.readFile(fullPath, 'utf-8');
    const stats = await fs.promises.stat(fullPath);
    const hash = this.computeHash(content);

    return {
      path: fullPath,
      relativePath: path.relative(this.currentRoot, fullPath).replace(/\\/g, '/'),
      content,
      hash,
      modifiedAt: stats.mtime.toISOString(),
    };
  }

  async writeFile(filePath: string, content: string, expectedHash?: string): Promise<{ success: boolean; hash: string }> {
    const fullPath = this.getSafeFullPath(filePath);

    return await lockManager.withLock(`file:${fullPath}`, async () => {
      if (fs.existsSync(fullPath) && expectedHash) {
        const existingContent = await fs.promises.readFile(fullPath, 'utf-8');
        const currentHash = this.computeHash(existingContent);
        if (currentHash !== expectedHash) {
          throw new Error('Stale write rejected: file was modified concurrently by another process');
        }
      }

      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) {
        await fs.promises.mkdir(parentDir, { recursive: true });
      }

      await fs.promises.writeFile(fullPath, content, 'utf-8');
      const newHash = this.computeHash(content);
      return { success: true, hash: newHash };
    });
  }

  async createEntry(targetPath: string, type: 'file' | 'directory'): Promise<boolean> {
    const fullPath = this.getSafeFullPath(targetPath);
    if (fs.existsSync(fullPath)) {
      throw new Error(`Entry already exists at ${targetPath}`);
    }

    if (type === 'directory') {
      await fs.promises.mkdir(fullPath, { recursive: true });
    } else {
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) {
        await fs.promises.mkdir(parentDir, { recursive: true });
      }
      await fs.promises.writeFile(fullPath, '', 'utf-8');
    }
    return true;
  }

  async renameEntry(oldPath: string, newPath: string): Promise<boolean> {
    const fullOld = this.getSafeFullPath(oldPath);
    const fullNew = this.getSafeFullPath(newPath);

    if (!fs.existsSync(fullOld)) {
      throw new Error(`Source does not exist: ${oldPath}`);
    }
    if (fs.existsSync(fullNew)) {
      throw new Error(`Destination already exists: ${newPath}`);
    }

    await fs.promises.rename(fullOld, fullNew);
    return true;
  }

  async deleteEntry(targetPath: string): Promise<boolean> {
    const fullPath = this.getSafeFullPath(targetPath);
    if (!fs.existsSync(fullPath)) {
      return false;
    }

    const stat = await fs.promises.stat(fullPath);
    if (stat.isDirectory()) {
      await fs.promises.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(fullPath);
    }
    return true;
  }

  async getGitStatus(): Promise<{ branch: string; files: Array<{ file: string; status: string }> }> {
    try {
      const { stdout: branchOut } = await execAsync('git branch --show-current', { cwd: this.currentRoot });
      const { stdout: statusOut } = await execAsync('git status --short', { cwd: this.currentRoot });

      const files = statusOut
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((line) => ({
          status: line.slice(0, 2).trim(),
          file: line.slice(3).trim(),
        }));

      return {
        branch: branchOut.trim() || 'main',
        files,
      };
    } catch {
      return { branch: 'main', files: [] };
    }
  }

  async getGitDiff(filePath?: string): Promise<string> {
    try {
      const cmd = filePath ? `git diff -- "${filePath}"` : 'git diff';
      const { stdout } = await execAsync(cmd, { cwd: this.currentRoot });
      return stdout;
    } catch {
      return '';
    }
  }

  async scanProject(): Promise<{
    root: string;
    name: string;
    scripts: Record<string, string>;
    stack: string[];
    testCommand?: string | undefined;
    hasGit: boolean;
  }> {
    let pkg: any = {};
    const pkgPath = path.join(this.currentRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'));
      } catch {}
    }

    const scripts = pkg.scripts || {};
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const stack: string[] = [];

    if (deps.react) stack.push('React');
    if (deps['next']) stack.push('Next.js');
    if (deps['vue']) stack.push('Vue');
    if (deps['express']) stack.push('Express');
    if (deps['typescript']) stack.push('TypeScript');
    if (deps['tailwindcss']) stack.push('TailwindCSS');
    if (deps['vite']) stack.push('Vite');
    if (deps['playwright']) stack.push('Playwright');
    if (deps['jest'] || deps['vitest']) stack.push(deps['vitest'] ? 'Vitest' : 'Jest');

    let testCommand: string | undefined;
    if (scripts.test) {
      testCommand = 'npm test';
    } else if (deps.vitest) {
      testCommand = 'npx vitest run';
    } else if (deps.jest) {
      testCommand = 'npx jest';
    }

    const hasGit = fs.existsSync(path.join(this.currentRoot, '.git'));

    return {
      root: this.currentRoot,
      name: pkg.name || path.basename(this.currentRoot),
      scripts,
      stack,
      testCommand,
      hasGit,
    };
  }
}

export const workspaceService = new WorkspaceService();
