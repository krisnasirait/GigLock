#!/usr/bin/env tsx
/**
 * Walks `packages/contracts/artifacts/contracts/<glob>.sol/<glob>.json` and writes
 * a typed `as const` ABI file per contract to `packages/shared/src/abis/`.
 *
 * Run via:  pnpm --filter @giglock/shared run generate-abis
 *
 * Skip silently if the contracts package has not been compiled yet
 * (artifacts/ does not exist).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../../../..");
const ARTIFACTS = join(ROOT, "packages/contracts/artifacts/contracts");
const OUT_DIR = join(ROOT, "packages/shared/src/abis");

function kebab(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

function findArtifacts(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findArtifacts(p));
    else if (entry.name.endsWith(".json") && !entry.name.endsWith(".dbg.json")) out.push(p);
  }
  return out;
}

function main() {
  const files = findArtifacts(ARTIFACTS);
  if (files.length === 0) {
    console.log("[generate-abis] no artifacts found — run `pnpm --filter @giglock/contracts compile` first");
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  for (const file of files) {
    const artifact = JSON.parse(readFileSync(file, "utf-8")) as { abi: unknown; contractName: string };
    const name = kebab(artifact.contractName);
    const outFile = join(OUT_DIR, `${name}.ts`);
    const content =
      `// AUTO-GENERATED — do not edit. Regenerate via: pnpm --filter @giglock/shared run generate-abis\n` +
      `export const ${artifact.contractName}Abi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n` +
      `export default ${artifact.contractName}Abi;\n`;
    writeFileSync(outFile, content, "utf-8");
    console.log(`[generate-abis] wrote ${outFile}`);
  }
}

main();
