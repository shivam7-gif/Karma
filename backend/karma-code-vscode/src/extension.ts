
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const openWorkspace = vscode.commands.registerCommand(
    "karmaCode.openWorkspace",
    async () => {
      const folders = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Open workspace for Karma",
      });

      if (!folders?.[0]) return;

      await vscode.commands.executeCommand(
        "vscode.openFolder",
        folders[0],
        true
      );
    }
  );

  const readActiveFile = vscode.commands.registerCommand(
    "karmaCode.readActiveFile",
    async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showInformationMessage(
          "Open a file first."
        );
        return;
      }

      const document = editor.document;

      if (document.isUntitled) {
        vscode.window.showWarningMessage(
          "Save the file before sharing it with Karma."
        );
        return;
      }

      const text = document.getText();

      // Return a bounded amount of content to avoid accidentally
      // sending huge files to the agent.
      const maxChars = 50000;

      return {
        fileName: document.fileName,
        languageId: document.languageId,
        content: text.slice(0, maxChars),
        truncated: text.length > maxChars,
      };
    }
  );

  const proposeActiveFileEdit = vscode.commands.registerCommand(
    "karmaCode.proposeActiveFileEdit",
    async (proposedContent: string) => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showInformationMessage(
          "Open a file before applying an edit."
        );
        return;
      }

      if (typeof proposedContent !== "string") {
        throw new Error("Expected proposed file content.");
      }

      const choice = await vscode.window.showWarningMessage(
        `Replace the contents of ${editor.document.fileName}?`,
        { modal: true },
        "Apply edit"
      );

      if (choice !== "Apply edit") return;

      const document = editor.document;
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );

      const applied = await editor.edit((editBuilder) => {
        editBuilder.replace(fullRange, proposedContent);
      });

      if (applied) {
        vscode.window.showInformationMessage(
          "Karma edit applied."
        );
      } else {
        vscode.window.showErrorMessage(
          "Could not apply the proposed edit."
        );
      }
    }
  );

  context.subscriptions.push(
    openWorkspace,
    readActiveFile,
    proposeActiveFileEdit
  );
}

export function deactivate() {}
