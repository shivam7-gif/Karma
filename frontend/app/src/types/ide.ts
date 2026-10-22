export interface WorkspaceFileNode {
  name: string;
  path: string;
  relativePath: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
  children?: WorkspaceFileNode[];
}

export interface EditorTab {
  path: string; // relative path
  name: string;
  content: string;
  hash: string;
  isDirty: boolean;
  language: string;
}

export interface TerminalProcess {
  processId: string;
  command: string;
  startTime: string;
  exitCode: number | null;
  outputBuffer: string[];
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

export interface GitStatusFile {
  file: string;
  status: string;
}
