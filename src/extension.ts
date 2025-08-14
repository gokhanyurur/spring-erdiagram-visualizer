import * as vscode from "vscode";
import { generateMermaidFromEntities } from "./parser";
import { Field, RelationType, Relation, Entity } from "./models";

const JAVA_PRIMITIVE_TYPES = [
  "byte", "short", "int", "long", "float", "double", "char", "boolean"
];

const JAVA_COMMON_SIMPLE_TYPES = [
  "String", "Integer", "Float", "Double", "Long", "Boolean", "Date",
  "LocalDate", "LocalDateTime", "BigDecimal", "BigInteger",
  "UUID", "Instant", "LocalTime", "Short", "Byte", "Character",
  "Timestamp", "Time", "Calendar", "ZonedDateTime", "OffsetDateTime",
  "OffsetTime", "Duration", "Period", "URL", "URI", "Enum"
];

const JAVA_PRIMITIVE_TYPES_AND_COMMONS = [
  ...JAVA_PRIMITIVE_TYPES,
  ...JAVA_COMMON_SIMPLE_TYPES
];

function parseJavaEntity(content: string): Entity | null {
  // Clean commented out code
  content = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

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

    // Detect relation annotation
    const relMatch = line.match(/@(OneToMany|ManyToOne|OneToOne|ManyToMany)/);
    if (relMatch) {
      pendingRelation = relMatch[1] as RelationType;
      continue;
    }

    // Detect field declaration
    const fieldMatch = line.match(/private\s+([\w<>?,\s]+)\s+(\w+)(?:\s*=\s*[^;]+)?\s*;/);
    if (!fieldMatch) {
      continue;
    }

    const rawType = fieldMatch[1].replace(/\s+/g, "");
    const fieldName = fieldMatch[2];
    const prevLine = i > 0 ? lines[i - 1].trim() : "";

    // Special cases
    if (prevLine.startsWith("@Enumerated") || prevLine.startsWith("@Embedded")) {
      fields.push({ type: rawType, name: fieldName });
      pendingRelation = null;
      continue;
    }

    const listMatch = rawType.match(/^List<(\w+)>$/);
    const mapMatch = rawType.match(/^Map<\w+,\s*(\w+)>$/);
    const setMatch = rawType.match(/^Set<(\w+)>$/);


    // If annotated with a relation
    if (pendingRelation) {
      let targetType = rawType;
      if (listMatch) {
        targetType = listMatch[1];
      }
      if (mapMatch) {
        targetType = mapMatch[1];
      }
      if (setMatch) {
        targetType = setMatch[1];
      }

      relations.push({ target: targetType.toUpperCase(), type: pendingRelation });
      fields.push({ 
        type: listMatch ? `List_${targetType}` : mapMatch ? `Map_${targetType}` : setMatch ? `Set_${targetType}` : targetType, name: fieldName
      });

      pendingRelation = null;
      continue;
    }

    // No relation annotation → try implicit relations
    if (listMatch) {
      const targetType = listMatch[1];
      relations.push({ target: targetType.toUpperCase(), type: "OneToMany" });
      fields.push({ type: `List_${targetType}`, name: fieldName });
      continue;
    }

    if (mapMatch) {
      const targetType = mapMatch[1];
      relations.push({ target: targetType.toUpperCase(), type: "OneToMany" });
      fields.push({ type: `Map_${targetType}`, name: fieldName });
      continue;
    }

    if (setMatch) {
      const targetType = setMatch[1];
      relations.push({ target: targetType.toUpperCase(), type: "OneToMany" });
      fields.push({ type: `Set_${targetType}`, name: fieldName });
      continue;
    }

    if (isCustomType(rawType)) {
      relations.push({ target: rawType.toUpperCase(), type: "ManyToOne" });
      fields.push({ type: rawType, name: fieldName });
      continue;
    }

    // Default primitive or simple type
    fields.push({ type: rawType, name: fieldName });
  }

  return { name, fields, relations };
}

function isCustomType(type: string): boolean {
  return /^[A-Z]\w+$/.test(type) && !JAVA_PRIMITIVE_TYPES_AND_COMMONS.includes(type);
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("erdiagram.generate", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "erDiagram",
      "Entity Diagram",
      vscode.ViewColumn.One,
      { enableScripts: true }
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

    for (const content of allFiles.values()) {
      const parsed = parseJavaEntity(content);
      if (parsed) {
        entities.push(parsed);
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
