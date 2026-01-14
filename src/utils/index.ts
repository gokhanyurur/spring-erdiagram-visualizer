

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
  const classDeclIndex = content.indexOf(classNameMatch[0]);
  const classBodyStart = content.indexOf("{", classDeclIndex);
  if (classBodyStart === -1) {
    return null;
  }

  const body = content.slice(classBodyStart + 1);
  const lines = body.split("\n");
  let depth = 1;
  let annotationBlockDepth = 0;
  let prevLine = "";
  let prevLineDepth = depth;
  const pushField = (type: string, fieldName: string) => {
    if (!fields.some((field) => field.name === fieldName)) {
      fields.push({ type, name: fieldName });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    const lineDepth = depth;

    if (lineDepth !== 1) {
      pendingRelation = null;
    }

    if (lineDepth === 1) {
      const relMatch = line.match(/@(OneToMany|ManyToOne|OneToOne|ManyToMany)/);
      if (relMatch) {
        pendingRelation = relMatch[1] as RelationType;
        prevLine = line;
        prevLineDepth = lineDepth;
        continue;
      }

      const fieldMatch = line.match(
        /^(?:private|protected|public)?\s*([\w<>?,\s]+)\s+(\w+)(?:\s*=\s*[^;]+)?\s*;/
      );
      if (fieldMatch) {
        const rawType = fieldMatch[1].replace(/\s+/g, "");
        const fieldName = fieldMatch[2];
        const prevIsFieldAnnotation = prevLineDepth === 1 &&
          (prevLine.startsWith("@Enumerated") || prevLine.startsWith("@Embedded"));

        if (prevIsFieldAnnotation) {
          pushField(rawType, fieldName);
          pendingRelation = null;
        } else {
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
            pushField(
              listMatch ? `List_${targetType}` : mapMatch ? `Map_${targetType}` : setMatch ? `Set_${targetType}` : targetType,
              fieldName
            );
            pendingRelation = null;
          } else if (listMatch) {
            const targetType = listMatch[1];
            pushField(`List_${targetType}`, fieldName);
          } else if (mapMatch) {
            const targetType = mapMatch[1];
            pushField(`Map_${targetType}`, fieldName);
          } else if (setMatch) {
            const targetType = setMatch[1];
            pushField(`Set_${targetType}`, fieldName);
          } else if (isCustomType(rawType)) {
            pushField(rawType, fieldName);
          } else {
            pushField(rawType, fieldName);
          }
        }
      } else if (pendingRelation) {
        const methodMatch = line.match(
          /^(?:public|protected|private)?\s*([\w<>?,\s]+)\s+(\w+)\s*\(\s*\)/
        );
        if (methodMatch) {
          const rawType = methodMatch[1].replace(/\s+/g, "");
          const methodName = methodMatch[2];
          const listMatch = rawType.match(/^List<(\w+)>$/);
          const mapMatch = rawType.match(/^Map<\w+,\s*(\w+)>$/);
          const setMatch = rawType.match(/^Set<(\w+)>$/);
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

          const fieldName = methodName.startsWith("get") && methodName.length > 3
            ? methodName.charAt(3).toLowerCase() + methodName.slice(4)
            : methodName.startsWith("is") && methodName.length > 2
            ? methodName.charAt(2).toLowerCase() + methodName.slice(3)
            : methodName;

          relations.push({ target: targetType.toUpperCase(), type: pendingRelation });
          pushField(
            listMatch ? `List_${targetType}` : mapMatch ? `Map_${targetType}` : setMatch ? `Set_${targetType}` : targetType,
            fieldName
          );
          pendingRelation = null;
        }
      }
    }

    prevLine = line;
    prevLineDepth = lineDepth;

    const opens = (rawLine.match(/{/g) || []).length;
    const closes = (rawLine.match(/}/g) || []).length;
    const isAnnotationLine = line.startsWith("@");
    if (annotationBlockDepth > 0 || isAnnotationLine) {
      annotationBlockDepth += opens - closes;
      if (annotationBlockDepth < 0) {
        annotationBlockDepth = 0;
      }
    } else {
      depth += opens - closes;
    }
    if (depth <= 0) {
      break;
    }
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
        body[data-theme="light"] .button {
          background: #f2f2f2;
          color: #1e1e1e;
          border: 1px solid #d0d0d0;
        }
        body[data-theme="light"] .button:hover {
          background: #e6e6e6;
        }
        .button:hover {
          background: #555;
          transform: translateY(-2px);
        }
        .diagram-container {
          flex: 1;
          overflow: hidden;
          padding: 20px;
        }
        body[data-theme="light"] .diagram-container {
          background: #ffffff;
        }
        body[data-theme="dark"] .diagram-container {
          background: #1e1e1e;
        }
        .diagram-viewport {
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
          cursor: grab;
        }
        .diagram-viewport.dragging {
          cursor: grabbing;
        }
        .diagram-stage {
          transform-origin: 0 0;
          will-change: transform;
        }
        .zoom-controls {
          position: absolute;
          right: 16px;
          top: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: 2;
        }
        .zoom-button {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid rgba(0, 0, 0, 0.2);
          background: #ffffff;
          color: #1e1e1e;
          font-size: 20px;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        }
        body[data-theme="dark"] .zoom-button {
          background: #2b2b2b;
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.2);
        }
        .zoom-button:hover {
          transform: translateY(-1px);
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
        body[data-theme="light"] .coffee {
          color: #b07600;
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
        <div class="diagram-viewport" id="diagram-viewport">
          <div class="diagram-stage mermaid" id="diagram-stage">${diagramCode}</div>
          <div class="zoom-controls" aria-label="Zoom controls">
            <button class="zoom-button" id="zoom-in" title="Zoom in (+)">+</button>
            <button class="zoom-button" id="zoom-out" title="Zoom out (-)">−</button>
          </div>
        </div>
      </div>
      <script src="${mermaidScriptUri}"></script>
      <script>
        const diagramContainer = document.getElementById("diagram-stage");
        const viewport = document.getElementById("diagram-viewport");
        const originalDiagram = diagramContainer.innerHTML;
        const zoomState = { scale: 1, x: 0, y: 0 };
        const zoomLimits = { min: 0.2, max: 3 };
        let isPanning = false;
        let panStart = { x: 0, y: 0 };
        let panOrigin = { x: 0, y: 0 };
        const zoomStep = 0.15;

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
          zoomState.scale = 1;
          zoomState.x = 0;
          zoomState.y = 0;
          updateTransform();
        };

        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

        const updateTransform = () => {
          diagramContainer.style.transform =
            "translate(" + zoomState.x + "px, " + zoomState.y + "px) scale(" + zoomState.scale + ")";
        };

        const zoomBy = (delta, centerX, centerY) => {
          const rect = viewport.getBoundingClientRect();
          const offsetX = centerX ?? rect.width / 2;
          const offsetY = centerY ?? rect.height / 2;
          const nextScale = clamp(zoomState.scale + delta, zoomLimits.min, zoomLimits.max);
          const scaleRatio = nextScale / zoomState.scale;
          zoomState.x = offsetX - (offsetX - zoomState.x) * scaleRatio;
          zoomState.y = offsetY - (offsetY - zoomState.y) * scaleRatio;
          zoomState.scale = nextScale;
          updateTransform();
        };

        viewport.addEventListener("wheel", (event) => {
          event.preventDefault();
          const rect = viewport.getBoundingClientRect();
          const offsetX = event.clientX - rect.left;
          const offsetY = event.clientY - rect.top;
          const delta = event.deltaY < 0 ? 1.1 : 0.9;
          const nextScale = clamp(zoomState.scale * delta, zoomLimits.min, zoomLimits.max);
          const scaleRatio = nextScale / zoomState.scale;

          zoomState.x = offsetX - (offsetX - zoomState.x) * scaleRatio;
          zoomState.y = offsetY - (offsetY - zoomState.y) * scaleRatio;
          zoomState.scale = nextScale;
          updateTransform();
        }, { passive: false });

        viewport.addEventListener("mousedown", (event) => {
          if (event.button !== 0) return;
          isPanning = true;
          viewport.classList.add("dragging");
          panStart = { x: event.clientX, y: event.clientY };
          panOrigin = { x: zoomState.x, y: zoomState.y };
        });

        window.addEventListener("mousemove", (event) => {
          if (!isPanning) return;
          const dx = event.clientX - panStart.x;
          const dy = event.clientY - panStart.y;
          zoomState.x = panOrigin.x + dx;
          zoomState.y = panOrigin.y + dy;
          updateTransform();
        });

        window.addEventListener("mouseup", () => {
          if (!isPanning) return;
          isPanning = false;
          viewport.classList.remove("dragging");
        });

        const zoomInButton = document.getElementById("zoom-in");
        const zoomOutButton = document.getElementById("zoom-out");
        zoomInButton.addEventListener("click", () => zoomBy(zoomStep));
        zoomOutButton.addEventListener("click", () => zoomBy(-zoomStep));

        window.addEventListener("keydown", (event) => {
          const target = event.target;
          const isTypingTarget =
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement ||
            target?.isContentEditable;
          if (isTypingTarget) {
            return;
          }

          if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            zoomBy(zoomStep);
          } else if (event.key === "-") {
            event.preventDefault();
            zoomBy(-zoomStep);
          }
        });

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
