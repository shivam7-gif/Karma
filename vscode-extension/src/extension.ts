import * as vscode from 'vscode';
import path from 'node:path';
import { KarmaClient, PatchProposal } from './karmaClient';
import { KarmaChatViewProvider } from './views/karmaChatViewProvider';

let karmaClient: KarmaClient;
let chatProvider: KarmaChatViewProvider;

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('karma');
  const serverUrl = config.get<string>('serverUrl', 'http://localhost:3000');
  const authToken = config.get<string>('authToken', 'dev-user');

  karmaClient = new KarmaClient(serverUrl, authToken);

  // Helper for applying patch safely via official VS Code WorkspaceEdit
  const applyPatchHandler = async (patch: PatchProposal) => {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder open in VS Code.');
      }

      const fileUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, patch.filePath));

      // Open document to check current content
      let document: vscode.TextDocument;
      try {
        document = await vscode.workspace.openTextDocument(fileUri);
      } catch {
        // File does not exist yet; create it
        const createEdit = new vscode.WorkspaceEdit();
        createEdit.createFile(fileUri, { ignoreIfExists: true, overwrite: false });
        await vscode.workspace.applyEdit(createEdit);
        document = await vscode.workspace.openTextDocument(fileUri);
      }

      // Check for stale edits if original content was provided
      if (patch.originalContent && document.getText() !== patch.originalContent) {
        const choice = await vscode.window.showWarningMessage(
          `File ${patch.filePath} has changed on disk since the patch was generated. Apply anyway?`,
          'Apply Anyway',
          'Cancel'
        );
        if (choice !== 'Apply Anyway') {
          return;
        }
      }

      // Show diff review preview
      const confirm = await vscode.window.showInformationMessage(
        `Apply proposed patch to ${patch.filePath}?`,
        'Apply Changes',
        'Reject'
      );

      if (confirm !== 'Apply Changes') {
        await karmaClient.rejectPatch(patch.patchId);
        vscode.window.showInformationMessage(`Patch rejected for ${patch.filePath}`);
        return;
      }

      // Apply edit using official WorkspaceEdit
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(fileUri, fullRange, patch.proposedContent);

      const applied = await vscode.workspace.applyEdit(edit);
      if (applied) {
        await document.save();
        await karmaClient.applyPatch(patch.patchId);
        vscode.window.showInformationMessage(`Successfully applied patch to ${patch.filePath}`);
      } else {
        vscode.window.showErrorMessage(`Failed to apply WorkspaceEdit to ${patch.filePath}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Error applying patch: ${msg}`);
    }
  };

  // Register Webview Provider
  chatProvider = new KarmaChatViewProvider(context.extensionUri, karmaClient, applyPatchHandler);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('karma.chatView', chatProvider)
  );

  // 1. Command: Connect
  const connectCmd = vscode.commands.registerCommand('karma.connect', async () => {
    try {
      const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const handshake = await karmaClient.handshake(rootPath);
      chatProvider.setConnectionState(true, handshake.workspace);
      vscode.window.showInformationMessage(`Connected to Karma Assistant (${handshake.workspace.projectName || 'Active'})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      chatProvider.setConnectionState(false);
      vscode.window.showErrorMessage(`Failed to connect to Karma: ${msg}`);
    }
  });

  // 2. Command: Disconnect
  const disconnectCmd = vscode.commands.registerCommand('karma.disconnect', () => {
    karmaClient.disconnect();
    chatProvider.setConnectionState(false);
    vscode.window.showInformationMessage('Disconnected from Karma Assistant');
  });

  // 3. Command: Sync Current Workspace
  const sendWorkspaceCmd = vscode.commands.registerCommand('karma.sendWorkspace', async () => {
    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!rootPath) {
      vscode.window.showWarningMessage('No workspace open to synchronize');
      return;
    }
    try {
      const handshake = await karmaClient.handshake(rootPath);
      vscode.window.showInformationMessage(`Synchronized workspace root: ${rootPath}`);
      chatProvider.setConnectionState(true, handshake.workspace);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Sync failed: ${msg}`);
    }
  });

  // 4. Action Commands
  const explainCmd = vscode.commands.registerCommand('karma.explainSelection', () => {
    chatProvider.handleSendPrompt('', 'explain');
  });

  const fixCmd = vscode.commands.registerCommand('karma.fixError', async () => {
    const editor = vscode.window.activeTextEditor;
    let diagnosticsList: any[] = [];
    if (editor) {
      const diags = vscode.languages.getDiagnostics(editor.document.uri);
      diagnosticsList = diags.map((d) => ({
        message: d.message,
        line: d.range.start.line + 1,
        severity: vscode.DiagnosticSeverity[d.severity],
      }));
    }
    chatProvider.handleSendPrompt('', 'fix');
  });

  const refactorCmd = vscode.commands.registerCommand('karma.refactorSelection', () => {
    chatProvider.handleSendPrompt('', 'refactor');
  });

  const generateTestsCmd = vscode.commands.registerCommand('karma.generateTests', () => {
    chatProvider.handleSendPrompt('', 'tests');
  });

  const reviewChangesCmd = vscode.commands.registerCommand('karma.reviewChanges', () => {
    chatProvider.handleSendPrompt('', 'review');
  });

  const askAboutFileCmd = vscode.commands.registerCommand('karma.askAboutFile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active file open.');
      return;
    }
    const fileName = path.basename(editor.document.uri.fsPath);
    const question = await vscode.window.showInputBox({
      prompt: `Ask Karma about ${fileName}`,
      placeHolder: 'e.g. How does this file handle state updates?',
    });
    if (question) {
      chatProvider.handleSendPrompt(question);
    }
  });

  const openInIdeCmd = vscode.commands.registerCommand('karma.openInKarmaIde', () => {
    vscode.env.openExternal(vscode.Uri.parse('http://localhost:5173/#ide'));
  });

  context.subscriptions.push(
    connectCmd,
    disconnectCmd,
    sendWorkspaceCmd,
    explainCmd,
    fixCmd,
    refactorCmd,
    generateTestsCmd,
    reviewChangesCmd,
    askAboutFileCmd,
    openInIdeCmd
  );

  // Auto connect if configured
  if (config.get<boolean>('autoSyncWorkspace', true)) {
    vscode.commands.executeCommand('karma.connect');
  }
}

export function deactivate() {
  if (karmaClient) {
    karmaClient.disconnect();
  }
}
