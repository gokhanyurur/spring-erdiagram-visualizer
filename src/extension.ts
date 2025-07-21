// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { generateMermaidDiagram } from './parser';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('erdiagram.generate', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const code = editor.document.getText();
    const diagram = generateMermaidDiagram(code);

    const panel = vscode.window.createWebviewPanel(
      'erdiagram',
      'ER Diagram',
      vscode.ViewColumn.Two,
      {}
    );

    panel.webview.html = `<html><body><pre>${diagram}</pre></body></html>`;
  });

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
