## JPA Visualizer [![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/gokhanyurur.jpa-visualizer)](https://marketplace.visualstudio.com/items?itemName=gokhanyurur.jpa-visualizer) [![Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=gokhanyurur.jpa-visualizer)

*Generate interactive ER diagrams from your Java JPA entities – right inside Visual Studio Code.*

#### ✨ Features
* 🔍 Automatically scans your workspace for `@Entity` classes
* 🧩 Detects fields and JPA relations `(@OneToMany, @ManyToOne, etc.)`
* 🗺️ Generates clean Mermaid ER diagrams in a VS Code webview
<img src="./docs/demo/generate-diagram.gif" width="600" alt="How to generate ER diagram" />
* 📤 Export diagrams as **SVG/PNG**
<img src="./docs/demo/export-as-svg.gif" width="600" alt="How to export as svg" />
* 📋 Copy **Mermaid code** to clipboard for documentation or sharing
<img src="./docs/demo/copy-as-mermaid.gif" width="600" alt="How to export as svg" />

#### 🚀 Quick Start
* Open the command palette `(Ctrl+Shift+P / Cmd+Shift+P)`
* Run `JPA Visualizer: Generate Diagram`

Your entity model appears instantly as an interactive ER diagram

#### ✅ Requirements
* VS Code v1.101.0+
* Java project with JPA annotations

#### 📌 Notes
* Focused on standard JPA annotations
* Complex mappings may be partially visualized

#### 📜 License
* Released under the **Business Source License 1.1 (BUSL-1.1)**

#### Development
Want to build or contribute? See [DEVELOPMENT.md](./docs/DEVELOPMENT.md).

##### Enjoy visualizing your JPA entities!