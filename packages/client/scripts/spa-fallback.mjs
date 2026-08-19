// GitHub Pages (and most static hosts) serve real files or a 404 — there's no
// concept of "run the SPA router for any unknown path" the way a dev server
// has. The standard workaround is a 404.html that's just a copy of index.html:
// the host serves it (with a real 404 status) for any unmatched path, the app
// shell loads anyway, and React Router takes it from there client-side.
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const indexPath = join(distDir, "index.html");
const fallbackPath = join(distDir, "404.html");

if (!existsSync(indexPath)) {
  console.error("dist/index.html not found — run this after `vite build`.");
  process.exit(1);
}

copyFileSync(indexPath, fallbackPath);
console.log("Created dist/404.html (SPA fallback for GitHub Pages)");
