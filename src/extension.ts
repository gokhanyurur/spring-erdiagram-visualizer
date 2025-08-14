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

    const relMatch = line.match(/@(OneToMany|ManyToOne|OneToOne|ManyToMany)/);
    if (relMatch) {
      pendingRelation = relMatch[1] as RelationType;
      continue;
    }

    const fieldMatch = line.match(/private\s+([\w<>?,\s]+)\s+(\w+)(?:\s*=\s*[^;]+)?\s*;/);
    if (!fieldMatch) {
      continue;
    }

    const rawType = fieldMatch[1].replace(/\s+/g, "");
    const fieldName = fieldMatch[2];
    const prevLine = i > 0 ? lines[i - 1].trim() : "";

    if (prevLine.startsWith("@Enumerated") || prevLine.startsWith("@Embedded")) {
      fields.push({ type: rawType, name: fieldName });
      pendingRelation = null;
      continue;
    }

    const listMatch = rawType.match(/^List<(\w+)>$/);
    const mapMatch = rawType.match(/^Map<\w+,\s*(\w+)>$/);
    const setMatch = rawType.match(/^Set<(\w+)>$/);

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
        type: listMatch ? `List_${targetType}` : mapMatch ? `Map_${targetType}` : setMatch ? `Set_${targetType}` : targetType,
        name: fieldName
      });
      pendingRelation = null;
      continue;
    }

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

    fields.push({ type: rawType, name: fieldName });
  }

  return { name, fields, relations };
}

function isCustomType(type: string): boolean {
  return /^[A-Z]\w+$/.test(type) && !JAVA_PRIMITIVE_TYPES_AND_COMMONS.includes(type);
}

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
        body {
          margin: 0;
          font-family: 'Inter', sans-serif;
          background: #1e1e1e;
          color: #fff;
          display: flex;
          flex-direction: column;
          height: 100vh;
        }
        .toolbar {
          display: flex;
          gap: 10px;
          padding: 10px 20px;
        }
        .button {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #3a3a3a;
          border: none;
          color: white;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        .button:hover {
          background: #555;
          transform: translateY(-2px);
        }
        .diagram-container {
          flex: 1;
          overflow: auto;
          padding: 20px;
        }
        .diagram-container svg {
          width: 100%;
          height: auto;
        }
        .coffee {
          margin-left: auto;
          color: #ffdd57;
          text-decoration: none;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .coffee:hover {
          color: #ffd700;
        }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <button onclick="copyMermaid()" class="button" id="copy-to-clipboard">📋 Copy as Mermaid</button>
        <button onclick="exportSVG()" class="button" id="export-svg">💾 Export as SVG</button>
        <a class="coffee" href="https://www.buymeacoffee.com/gokhanyurur" target="_blank">☕ Support</a>
      </div>
      <div class="diagram-container">
        <div class="mermaid">${diagramCode}</div>
      </div>
      <script type="module">
        import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
        mermaid.initialize({ startOnLoad: true });

        window.copyMermaid = () => {
          navigator.clipboard.writeText(\`${diagramCode}\`).then(() => {
            alert('Mermaid code copied to clipboard!');
          });
        };

        window.exportSVG = () => {
          const svg = document.querySelector('svg');
          if (!svg) return;
          const serializer = new XMLSerializer();
          const svgBlob = new Blob([serializer.serializeToString(svg)], {type:"image/svg+xml;charset=utf-8"});
          const url = URL.createObjectURL(svgBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "diagram.svg";
          a.click();
          URL.revokeObjectURL(url);
        };

        window.exportPNG = () => {
          const svgElement = document.querySelector("svg");
          if (!svgElement) {
            alert("SVG not found!");
            return;
          }

          const bbox = svgElement.getBBox();
          const width = bbox.width;
          const height = bbox.height;

          if (!svgElement.hasAttribute("viewBox")) {
            svgElement.setAttribute("viewBox", (bbox.x + " " + bbox.y + " " + width + " " + height));
          }

          const svgData = new XMLSerializer().serializeToString(svgElement);
          const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
          const url = URL.createObjectURL(svgBlob);

          const img = new Image();
          img.onload = () => {
            const scale = 3;
            const canvas = document.createElement("canvas");
            canvas.width = width * scale;
            canvas.height = height * scale;

            const ctx = canvas.getContext("2d");
            ctx.setTransform(scale, 0, 0, scale, 0, 0);
            ctx.drawImage(img, 0, 0);

            const pngData = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = pngData;
            link.download = "diagram.png";
            link.click();

            URL.revokeObjectURL(url);
          };
          img.src = url;
        };
      </script>
    </body>
    </html>
  `;
}

export function deactivate() {}
