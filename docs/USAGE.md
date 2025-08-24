# JPA Visualizer

JPA Visualizer lets you generate interactive ER diagrams from your Java JPA entities directly in VS Code.

Automatically scans your workspace for `@Entity` classes.

Parses entity fields and JPA relations (`@OneToMany`, `@ManyToOne`, etc.)

Generates Mermaid ER diagrams and displays them in a VS Code webview.

Export diagrams as **SVG/PNG** or copy **Mermaid code** to clipboard.

**Quick Start:** Open the command palette `(Ctrl+Shift+P / Cmd+Shift+P)` → run `JPA Visualizer: Generate Diagram.`

Supports VS Code v1.101.0+ and Java projects using JPA annotations.