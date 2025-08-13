import * as vscode from "vscode";
import { generateMermaidFromEntities } from "./parser";

interface Field {
  name: string;
  type: string;
}

type RelationType = "OneToMany" | "ManyToOne" | "OneToOne" | "ManyToMany";

interface Relation {
  type: RelationType;
  target: string;
}

interface Entity {
  name: string;
  fields: Field[];
  relations?: Relation[];
}

const PRIMITIVE_TYPES = [
  "String", "Integer", "Float", "Double", "Long", "Boolean", "Date",
  "LocalDate", "LocalDateTime",
  "int", "float", "double", "long", "boolean", "char", "byte", "short"
];

function parseJavaEntity(
  content: string,
): Entity | null {
  // Clean commented out code
  // Single line comments (// ...)
  content = content.replace(/\/\/.*$/gm, "");
  // Multiline comments (/* ... */ and /** ... */)
  content = content.replace(/\/\*[\s\S]*?\*\//g, "");

  if (!/@Entity\b/.test(content)) {
    return null;
  }

  const classNameMatch = content.match(/class\s+(\w+)/);
  if (!classNameMatch) {
    return null;
  }

  const name = classNameMatch[1];
  const fields: Field[] = [];
  const relations: Relation[] = [];

  let pendingRelation: RelationType | null = null;
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Relation annotation
    const relMatch = line.match(/@(OneToMany|ManyToOne|OneToOne|ManyToMany)/);
    if (relMatch) {
      pendingRelation = relMatch[1] as RelationType;
      continue;
    }

    // Field declaration
    const fieldMatch = line.match(/private\s+([\w<>]+)\s+(\w+)(?:\s*=\s*[^;]+)?\s*;/);
    if (!fieldMatch) {
      continue;
    }

    const rawType = fieldMatch[1];
    const fieldName = fieldMatch[2];
    const prevLine = i > 0 ? lines[i - 1].trim() : "";

    const isEnum = prevLine.startsWith("@Enumerated");
    const isEmbedded = prevLine.startsWith("@Embedded");

    if (isEmbedded || isEnum) {
      fields.push({ type: rawType, name: fieldName });
      pendingRelation = null;
      continue;
    }

    const listMatch = rawType.match(/^List<(\w+)>$/);
    if (pendingRelation) {
      const targetType = listMatch ? listMatch[1] : rawType;
      relations.push({ target: targetType.toUpperCase(), type: pendingRelation });
      fields.push({ type: listMatch ? `${targetType}[]` : targetType, name: fieldName });
      pendingRelation = null;
      continue;
    }

    if (listMatch) {
      const targetType = listMatch[1];
      relations.push({ target: targetType.toUpperCase(), type: "OneToMany" });
      fields.push({ type: `${targetType}[]`, name: fieldName });
      continue;
    }

    if (isCustomType(rawType)) {
      relations.push({ target: rawType.toUpperCase(), type: "ManyToOne" });
      fields.push({ type: rawType, name: fieldName });
      continue;
    }

    fields.push({ type: rawType, name: fieldName });
  }

  return { name, fields, relations };
}

function isCustomType(type: string): boolean {
  return /^[A-Z]\w+$/.test(type) && !PRIMITIVE_TYPES.includes(type);
}

export function activate(context: vscode.ExtensionContext) {
  const extensionUri = context.extensionUri;
  
  const disposable = vscode.commands.registerCommand("erdiagram.generate", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "erDiagram",
      "Entity Diagram",
      vscode.ViewColumn.One,
      { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")] }
    );

    const files = await vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: "Select Entity Files",
      filters: { "Java Files": ["java"] },
    });

    if (!files?.length) {
      vscode.window.showErrorMessage("No files selected.");
      return;
    }

    const allFiles = await loadFiles(files);
    const entities: Entity[] = [];

    for (const [, contentStr] of allFiles.entries()) {
      const parsedEntity = parseJavaEntity(contentStr);
      if (parsedEntity) {
        entities.push(parsedEntity);
      }
    }

    const diagram = generateMermaidFromEntities(entities);
    panel.webview.html = getMermaidHtml(diagram);
  });

  context.subscriptions.push(disposable);
}

async function loadFiles(files: vscode.Uri[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const file of files) {
    const fileContent = await vscode.workspace.fs.readFile(file);
    map.set(file.fsPath, Buffer.from(fileContent).toString("utf8"));
  }
  return map;
}

function getMermaidHtml(diagramCode: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body { background-color: #1e1e1e; color: white; padding: 20px; }
      </style>
    </head>
    <body>
      <div class="mermaid">${diagramCode}</div>
      <script type="module">
        import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
        mermaid.initialize({ startOnLoad: true });
      </script>
    </body>
    </html>
  `;
}

export function deactivate() {}
