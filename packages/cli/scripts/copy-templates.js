// copy-templates.js — copies template directories into the CLI package
// so they get bundled in the npm publish. Runs via `prepublishOnly`.
// Pure Node.js, no external deps.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(pkgRoot, "..", "..");
const srcTemplates = path.join(repoRoot, "templates");
const destTemplates = path.join(pkgRoot, "templates");

const EXCLUDE = new Set(["node_modules", "dist", ".git", "__pycache__", ".venv", "venv"]);

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

// Clean old copy
if (fs.existsSync(destTemplates)) {
  fs.rmSync(destTemplates, { recursive: true, force: true });
}

if (!fs.existsSync(srcTemplates)) {
  console.error("Source templates directory not found:", srcTemplates);
  process.exit(1);
}

copyDir(srcTemplates, destTemplates);

// Count what we copied
function countFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) n += countFiles(p);
    else if (entry.isFile()) n++;
  }
  return n;
}

const count = countFiles(destTemplates);
console.log(`Copied ${count} template files to ${destTemplates}`);
