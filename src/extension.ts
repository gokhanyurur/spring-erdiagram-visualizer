// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { generateMermaidDiagram } from './parser';
// import { parseJavaEntity } from './parser/javaEntityParser';

interface Entity {
  name: string;
  fields: { name: string; type: string }[];
  relations?: { type: 'OneToMany' | 'ManyToOne' | 'OneToOne'; target: string; field: string }[];
}

function parseJavaEntity(content: string): Entity | null {
  if (!/@Entity\b/.test(content)) {
    return null;
  }

  const classNameMatch = content.match(/class\s+(\w+)/);
  if (!classNameMatch) return null;
  const name = classNameMatch[1];

  const fieldRegex = /private\s+([\w<>]+)\s+(\w+);/g;
  const fields: { name: string; type: string }[] = [];

  let match;
  while ((match = fieldRegex.exec(content)) !== null) {
    fields.push({ type: match[1], name: match[2] });
  }

  return { name, fields };
}

export function activate(context: vscode.ExtensionContext) {
  const extensionUri = context.extensionUri;
  const disposable = vscode.commands.registerCommand('erdiagram.generate', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const panel = vscode.window.createWebviewPanel(
      'erDiagram',
      'Entity Diagram',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );

    const files = await vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: 'Select Entity Files',
      filters: {
        'Java Files': ['java']
      }
    });

    if( !files || files.length === 0) {
      vscode.window.showErrorMessage('No files selected.');
      return;
    }

    
    console.log('files zort:', files);

    const entities: Entity[] = [];

    for (const file of files) {
      const fileContent = await vscode.workspace.fs.readFile(file);
      const contentStr = Buffer.from(fileContent).toString('utf8');
      const parsedEntity = parseJavaEntity(contentStr);
      if (parsedEntity) {
        entities.push(parsedEntity);
      }
    }

    console.log('Parsed Entities:', entities);

    const diagram = generateMermaidDiagram(entities);
    console.log('Generated Mermaid Diagram:', diagram);
    
    panel.webview.html = getMermaidHtml(diagram);
  });

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

function getMermaidHtml(diagramCode: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          background-color: #1e1e1e;
          color: white;
          padding: 20px;
        }
      </style>
    </head>
    <body>
      <div class="mermaid">
        ${diagramCode}
      </div>

      <script type="module">
        import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
        mermaid.initialize({ startOnLoad: true });
      </script>
    </body>
    </html>
  `;
}
