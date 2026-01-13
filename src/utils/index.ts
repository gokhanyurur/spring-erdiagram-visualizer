

import { Uri } from "vscode";
import type { Field, RelationType, Relation, Entity } from "../models/index.js";
import { JAVA_PRIMITIVE_TYPES_AND_COMMONS } from "./constants.js";

export function parseJavaEntity(content: string): Entity | null {
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

    const fieldMatch = line.match(/^(?:private|protected|public)?\s*([\w<>?,\s]+)\s+(\w+)(?:\s*=\s*[^;]+)?\s*;/);
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
      fields.push({ type: `List_${targetType}`, name: fieldName });
      continue;
    }

    if (mapMatch) {
      const targetType = mapMatch[1];
      fields.push({ type: `Map_${targetType}`, name: fieldName });
      continue;
    }

    if (setMatch) {
      const targetType = setMatch[1];
      fields.push({ type: `Set_${targetType}`, name: fieldName });
      continue;
    }

    if (isCustomType(rawType)) {
      fields.push({ type: rawType, name: fieldName });
      continue;
    }

    fields.push({ type: rawType, name: fieldName });
  }

  return { name, fields, relations };
}

export function isCustomType(type: string): boolean {
  return /^[A-Z]\w+$/.test(type) && !JAVA_PRIMITIVE_TYPES_AND_COMMONS.includes(type);
}

export function getMermaidHtml(diagramCode: string, mermaidScriptUri: Uri): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          margin: 0;
          font-family: 'Inter', sans-serif;
          display: flex;
          flex-direction: column;
          height: 100vh;
        }
        body[data-theme="light"] {
          background: #ffffff;
          color: #1e1e1e;
        }
        body[data-theme="dark"] {
          background: #1e1e1e;
          color: #ffffff;
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
        body[data-theme="light"] .diagram-container {
          background: #ffffff;
        }
        body[data-theme="dark"] .diagram-container {
          background: #1e1e1e;
        }
        .diagram-container svg {
          width: 100%;
          height: auto;
        }
        .theme-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .theme-toggle-label {
          font-size: 13px;
        }
        .switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #999;
          transition: 0.2s;
          border-radius: 999px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.2s;
          border-radius: 50%;
        }
        input:checked + .slider {
          background-color: #4b9fff;
        }
        input:checked + .slider:before {
          transform: translateX(20px);
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
        <div class="theme-toggle">
          <span class="theme-toggle-label">Light</span>
          <label class="switch">
            <input type="checkbox" id="theme-toggle" />
            <span class="slider"></span>
          </label>
          <span class="theme-toggle-label">Dark</span>
        </div>
        <a class="coffee" href="https://www.buymeacoffee.com/gokhanyurur" target="_blank">☕ Support</a>
      </div>
      <div class="diagram-container">
        <div class="mermaid">${diagramCode}</div>
      </div>
      <script src="${mermaidScriptUri}"></script>
      <script>
        const diagramContainer = document.querySelector(".mermaid");
        const originalDiagram = diagramContainer.innerHTML;

        const maxDiagramTextSize = 200000;
        const darkThemeConfig = {
          theme: "base",
          themeVariables: {
            background: "#1e1e1e",
            lineColor: "#ffffff",
            textColor: "#ffffff",
            mainBkg: "#f1f1ff",
            nodeBorder: "#aa90e4",
          }
        };

        const lightThemeConfig = {
          theme: "default"
        };

        const applyTheme = (isDark) => {
          document.body.dataset.theme = isDark ? "dark" : "light";
          const config = isDark ? darkThemeConfig : lightThemeConfig;
          mermaid.initialize({ startOnLoad: false, maxTextSize: maxDiagramTextSize, ...config });
          diagramContainer.innerHTML = originalDiagram;
          diagramContainer.removeAttribute("data-processed");
          mermaid.run({ querySelector: ".mermaid" });
        };

        const ensureViewBox = (svgElement) => {
          if (!svgElement.hasAttribute("viewBox")) {
            const bbox = svgElement.getBBox();
            svgElement.setAttribute(
              "viewBox",
              bbox.x + " " + bbox.y + " " + bbox.width + " " + bbox.height
            );
          }
        };

        const renderSvgForExport = async () => {
          const isDark = document.body.dataset.theme === "dark";
          mermaid.initialize({
            startOnLoad: false,
            maxTextSize: maxDiagramTextSize,
            ...lightThemeConfig
          });
          const { svg } = await mermaid.render("export-" + Date.now(), originalDiagram);
          if (isDark) {
            applyTheme(true);
          } else {
            applyTheme(false);
          }
          return svg;
        };

        const isVsCodeDark =
          document.body.classList.contains("vscode-dark") ||
          document.body.classList.contains("vscode-high-contrast");

        const themeToggle = document.getElementById("theme-toggle");
        themeToggle.checked = isVsCodeDark;
        themeToggle.addEventListener("change", () => {
          applyTheme(themeToggle.checked);
        });

        applyTheme(isVsCodeDark);

        window.copyMermaid = () => {
          navigator.clipboard.writeText(\`${diagramCode}\`).then(() => {
            alert('Mermaid code copied to clipboard!');
          });
        };

        window.exportSVG = () => {
          const svgElement = document.querySelector("svg");
          if (!svgElement) return;
          ensureViewBox(svgElement);
          renderSvgForExport().then((svgText) => {
            const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(svgBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "diagram.svg";
            a.click();
            URL.revokeObjectURL(url);
          });
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

          ensureViewBox(svgElement);

          renderSvgForExport().then((svgText) => {
            const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(svgBlob);

            const img = new Image();
            img.onload = () => {
              const scale = 3;
              const canvas = document.createElement("canvas");
              canvas.width = width * scale;
              canvas.height = height * scale;

              const ctx = canvas.getContext("2d");
              if (!ctx) {
                alert("Canvas context not available.");
                return;
              }

              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
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
          });
        };
      </script>
    </body>
    </html>
  `;
}
