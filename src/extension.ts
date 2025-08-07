// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { generateMermaidFromEntities } from "./parser";

interface Entity {
  name: string;
  fields: { name: string; type: string }[];
  relations?: {
    type: "OneToMany" | "ManyToOne" | "OneToOne" | "ManyToMany";
    target: string;
  }[];
}

function parseJavaEntity(content: string): Entity | null {
  if (!/@Entity\b/.test(content)) {
    return null;
  }

  const classNameMatch = content.match(/class\s+(\w+)/);
  if (!classNameMatch) {
    return null;
  }

  const name = classNameMatch[1];
  const fields: { name: string; type: string }[] = [];
  const relations: {
    target: string;
    type: "OneToMany" | "ManyToOne" | "OneToOne" | "ManyToMany";
  }[] = [];

  let pendingRelation:
    | "OneToMany"
    | "ManyToOne"
    | "OneToOne"
    | "ManyToMany"
    | null = null;

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const relMatch = line.match(/@(OneToMany|ManyToOne|OneToOne|ManyToMany)/);
    if (relMatch) {
      pendingRelation = relMatch[1] as unknown as typeof pendingRelation;
      continue;
    }

    const fieldMatch = line.match(/private\s+([\w<>]+)\s+(\w+);/);
    if (fieldMatch) {
      const rawType = fieldMatch[1];
      const fieldName = fieldMatch[2];

      const prevLine = i > 0 ? lines[i - 1].trim() : "";
      if (prevLine.startsWith("@Enumerated")) {
        fields.push({ type: rawType, name: fieldName });
        pendingRelation = null;
        continue;
      }

      if (pendingRelation) {
        const listMatch = rawType.match(/^List<(\w+)>$/);
        const targetType = listMatch ? listMatch[1] : rawType;
        relations.push({
          target: targetType.toUpperCase(),
          type: pendingRelation,
        });
        pendingRelation = null;
        continue;
      }

      const listMatch = rawType.match(/^List<(\w+)>$/);
      if (listMatch) {
        const targetType = listMatch[1];
        relations.push({ target: targetType.toUpperCase(), type: "OneToMany" });
        pendingRelation = null;
        continue;
      }

      if (
        /^[A-Z]\w+$/.test(rawType) &&
        ![
          "String", "Integer", "Float", "Double", "Long", "Boolean", "Date",
          "LocalDate", "LocalDateTime",
          "int", "float", "double", "long", "boolean", "char", "byte", "short"
        ].includes(rawType)
      ) {
        relations.push({ target: rawType.toUpperCase(), type: "ManyToOne" });
        pendingRelation = null;
        continue;
      }

      fields.push({ type: rawType, name: fieldName });
      pendingRelation = null;
    }
  }

  return { name, fields, relations };
}

export function activate(context: vscode.ExtensionContext) {
  const extensionUri = context.extensionUri;
  const disposable = vscode.commands.registerCommand(
    "erdiagram.generate",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const panel = vscode.window.createWebviewPanel(
        "erDiagram",
        "Entity Diagram",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
        }
      );

      const files = await vscode.window.showOpenDialog({
        canSelectMany: true,
        openLabel: "Select Entity Files",
        filters: {
          "Java Files": ["java"],
        },
      });

      if (!files || files.length === 0) {
        vscode.window.showErrorMessage("No files selected.");
        return;
      }

      const entities: Entity[] = [];

      for (const file of files) {
        const fileContent = await vscode.workspace.fs.readFile(file);
        const contentStr = Buffer.from(fileContent).toString("utf8");
        const parsedEntity = parseJavaEntity(contentStr);
        if (parsedEntity) {
          entities.push(parsedEntity);
        }
      }

      const diagram = generateMermaidFromEntities(entities);
      console.log("Generated Mermaid Diagram:", diagram);

      panel.webview.html = getMermaidHtml(diagram);
    }
  );

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
