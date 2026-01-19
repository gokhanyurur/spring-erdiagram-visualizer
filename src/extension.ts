import * as vscode from "vscode";
import { generateMermaidFromEntities } from "./mermaidParser.js";
import type { Entity } from "./models/index.js";
import { parseJavaEntity, getMermaidHtml } from "./utils/index.js";

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

export async function generateERD(context: vscode.ExtensionContext) {
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage("No workspace folder is open.");
    return;
  }

  let selectedFolder: vscode.Uri;

  if (folders.length === 1) {
    // If only one workspace folder, use it directly
    selectedFolder = folders[0].uri;
  } else {
    // If multiple workspace folders, prompt the user to select one
    const picked = await vscode.window.showQuickPick(
      folders.map(f => f.name),
      { placeHolder: "Select the workspace folder to scan for Java files" }
    );

    if (!picked) {
      vscode.window.showErrorMessage("No folder selected.");
      return;
    }

    selectedFolder = folders.find(f => f.name === picked)!.uri;
  }

  const diagram = await buildDiagramFromFolder(selectedFolder);
  if (!diagram) {
    vscode.window.showErrorMessage("No Java files found in the selected folder.");
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "erDiagram",
    "Entity Relationship Diagram",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  const mermaidScriptUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "media", "mermaid.min.js")
  );

  panel.webview.html = getMermaidHtml(diagram, mermaidScriptUri);

  const folderPath = selectedFolder.fsPath;
  const saveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
    if (!document.uri.fsPath.startsWith(folderPath) || !document.uri.fsPath.endsWith(".java")) {
      return;
    }
    const updatedDiagram = await buildDiagramFromFolder(selectedFolder);
    if (!updatedDiagram) {
      return;
    }
    panel.webview.postMessage({ type: "diagramUpdate", diagram: updatedDiagram });
  });
  panel.onDidDispose(() => saveListener.dispose());

}

async function buildDiagramFromFolder(folder: vscode.Uri): Promise<string | null> {
  const javaFiles = await getAllJavaFilesInFolder(folder);
  if (!javaFiles.length) {
    return null;
  }

  const allFiles = await loadFiles(javaFiles);
  const entities: Entity[] = [];

  for (const content of allFiles.values()) {
    const parsed = parseJavaEntity(content);
    if (parsed) {
      entities.push(parsed);
    }
  }

  return generateMermaidFromEntities(entities);
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("jpaVisualizer.generateDiagram", async() => generateERD(context));
  context.subscriptions.push(disposable);
}

export function deactivate() {}
