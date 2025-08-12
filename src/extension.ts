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

function parseJavaEntity(
  content: string,
  allFiles?: Map<string, string>,
  isEmbededContent = false
): Entity | null {
  if (!isEmbededContent && !/@Entity\b/.test(content)) {
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
      const isEnum = prevLine.startsWith("@Enumerated");
      const isEmbedded = prevLine.startsWith("@Embedded");

      if (isEnum) {
        fields.push({ type: rawType, name: fieldName });
        pendingRelation = null;
        continue;
      }

      if (isEmbedded && allFiles) {
        //TODO handle EmbeddedColumnNaming annotation
        const embeddedClassName = rawType;
        for (const [_, fileContent] of allFiles.entries()) {
          if (fileContent.includes(`class ${embeddedClassName}`)) {
            const embeddedEntity = parseJavaEntity(fileContent, allFiles, true);
            if (embeddedEntity) {
              for (const embeddedField of embeddedEntity.fields) {
                fields.push({
                  type: embeddedField.type,
                  name: `${fieldName}_${embeddedField.name}`,
                });
              }
            }
            break;
          }
        }
        pendingRelation = null;
        continue;
      }

      const listMatch = rawType.match(/^List<(\w+)>$/);
      if (pendingRelation) {
        const targetType = listMatch ? listMatch[1] : rawType;
        relations.push({
          target: targetType.toUpperCase(),
          type: pendingRelation,
        });
        fields.push({ type: `${targetType}`, name: fieldName });
        pendingRelation = null;
        continue;
      }

      
      if (listMatch) {
        const targetType = listMatch[1];
        relations.push({ target: targetType.toUpperCase(), type: "OneToMany" });
        fields.push({ type: `${targetType}[]`, name: fieldName });
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
        fields.push({ type: rawType, name: fieldName });
        pendingRelation = null;
        continue;
      }

      fields.push({ type: rawType, name: fieldName });
      pendingRelation = null;
    }
  }
  // TODO process JoinColumn and add relation id
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

      const allFiles = new Map<string, string>();
      for (const file of files) {
        const fileContent = await vscode.workspace.fs.readFile(file);
        const contentStr = Buffer.from(fileContent).toString("utf8");
        allFiles.set(file.fsPath, contentStr);
      }

      const entities: Entity[] = [];

      for (const [_, contentStr] of allFiles.entries()) {
        const parsedEntity = parseJavaEntity(contentStr, allFiles);
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
