# JPA Visualizer

Generate interactive ER diagrams from your Java JPA entities directly in Visual Studio Code.

## Features

- Scans your workspace for Java files annotated with `@Entity`
- Parses entity fields and JPA relations (`@OneToMany`, `@ManyToOne`, etc.)
- Generates Mermaid ER diagrams for your data model
- Displays diagrams in a VS Code webview panel
- Export diagrams as SVG or PNG
- Copy Mermaid code to clipboard

## Getting Started

1. **Install dependencies:**
   ```sh
   npm install
2. **Build the extension:**
   ```sh
   npm run build
3. **Launch in VS Code:**
- Press `F5` to open a new Extension Development Host window.

4. **Generate a diagram:**
- Open the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
- Run `JPA Visualizer: Generate Diagram`

## Requirements
- Visual Studio Code v1.101.0 or newer
- Java source files using JPA annotations
## Usage
- The extension scans all Java files in your workspace for JPA entities.
- It parses fields and relations, then generates a Mermaid ER diagram.
- The diagram is rendered in a webview panel with export and copy options.
## Development
- Source code is in `src/`
- Build scripts: `build.js`
- Mermaid library is bundled from `node_modules/mermaid/dist/mermaid.min.js` to `media/mermaid.min.js`
## Known Issues
- Only supports basic JPA annotations and simple entity structures.
- Complex mapping scenarios may not be fully visualized.
# Contributing
- Pull requests and issues are welcome!
# License
This project is licensed under the Business Source License 1.1 (BUSL-1.1).
- ✅ You can read, modify, and use the code for non-commercial and personal/educational purposes.
- 🚫 You cannot use it in production or for commercial purposes until the change date.
- 📅 On 2029-01-01, the license will automatically convert to MIT, making it free for all uses.
# Extension Usage
- See `docs/USAGE.md`

##### Enjoy visualizing your JPA entities!