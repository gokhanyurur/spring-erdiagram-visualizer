import * as vscode from "vscode";
import { generateMermaidFromEntities } from "./mermaidParser";
import type { Entity } from "./models";
import { parseJavaEntity, getMermaidHtml } from "./utils";

async function getAllJavaFilesInFolder(folderUri: vscode.Uri): Promise<vscode.Uri[]> {
  const uris: vscode.Uri[] = [];
  async function traverseFolder(uri: vscode.Uri) {
    const entries = await vscode.workspace.fs.readDirectory(uri);
    for (const [name, type] of entries) {
      const entryUri = vscode.Uri.joinPath(uri, name);
      if (type === vscode.FileType.Directory) {
        await traverseFolder(entryUri);
      } else if (name.endsWith(".java")) {
        uris.push(entryUri);
      }
    }
  }
  await traverseFolder(folderUri);
  return uris;
}

async function loadFiles(files: vscode.Uri[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const file of files) {
    const fileContent = await vscode.workspace.fs.readFile(file);
    map.set(file.fsPath, Buffer.from(fileContent).toString("utf8"));
  }
  return map;
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("erdiagram.generate", async () => {
    const folder = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: "Select Root Folder"
    });

    if (!folder?.length) {
      vscode.window.showErrorMessage("No folder selected.");
      return;
    }

    const javaFiles = await getAllJavaFilesInFolder(folder[0]);
    if (!javaFiles.length) {
      vscode.window.showErrorMessage("No Java files found in the selected folder.");
      return;
    }

    const allFiles = await loadFiles(javaFiles);
    const entities: Entity[] = [];

    for (const content of allFiles.values()) {
      const parsed = parseJavaEntity(content);
      if (parsed) {
        entities.push(parsed);
      }
    }

    const diagram = generateMermaidFromEntities(entities);

    const panel = vscode.window.createWebviewPanel(
      "erDiagram",
      "Entity Diagram",
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = getMermaidHtml(diagram);
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
