import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const outdir = "dist";
const mediaDir = "media";

await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  minify: true,
  platform: "node",
  format: "cjs",
  outfile: `${outdir}/extension.js`,
  sourcemap: false,
  target: ["node18"],
  external: ["vscode"],
});

// Copy package.json and README.md
mkdirSync(outdir, { recursive: true });
copyFileSync("package.json", `${outdir}/package.json`);
copyFileSync("README.md", `${outdir}/README.md`);

// Copy mermaid.min.js from node_modules to media/
mkdirSync(mediaDir, { recursive: true });
copyFileSync(
  resolve("node_modules/mermaid/dist/mermaid.min.js"),
  resolve(mediaDir, "mermaid.min.js")
);

console.log("✅ Build complete! Files written to dist/ and media/");
