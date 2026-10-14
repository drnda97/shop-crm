// Skraćenica "@/" iz tsconfig.json za skripte van Next-a: Node je ne poznaje, pa je ovde
// prevodimo u putanju fajla (npr. "@/lib/routes" → lib/routes.ts). Uključuje se sa
// node --import ./scripts/alias.mjs (vidi package.json).
import { existsSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (!globalThis.shopcrmAlias) {
  globalThis.shopcrmAlias = true;
  register(import.meta.url, { data: { root: path.resolve(import.meta.dirname, "..") } });
}

let root = "";

export function initialize(data) {
  root = data.root;
}

export async function resolve(specifier, context, next) {
  if (root && specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2));
    const file = [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`, path.join(base, "index.ts")].find(
      (candidate) => existsSync(candidate) && !candidate.endsWith(path.sep),
    );
    if (file) return next(pathToFileURL(file).href, context);
  }
  return next(specifier, context);
}
