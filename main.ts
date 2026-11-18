// SOLMAR BAY — entry program for make.fun gta6-01 ("Make GTA 6").
// It hands the game in: copies game/ and screenshots/ from this repository
// into the output directory and writes /output/dossier.json with buildDossier
// from vendor/makefun-game.ts, the kit's own library, unchanged.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// The gate's limits for this bounty, from the kit's reference/gate.json.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function copyTree(name: string): void {
  const src = join(repoRoot, name);
  const dst = join(outputDir, name);
  if (!existsSync(src)) throw new Error(`missing ${name}/ in the repository`);
  if (!statSync(src).isDirectory()) throw new Error(`${name}/ is not a directory`);
  cpSync(src, dst, { recursive: true, dereference: false });
}

function main(): void {
  mkdirSync(outputDir, { recursive: true });
  // Start clean so a stale file from an earlier run can never leak in.
  for (const name of ['game', 'screenshots']) {
    const dst = join(outputDir, name);
    if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
  }
  copyTree('game');
  copyTree('screenshots');

  const dossier = buildDossier(outputDir, CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  console.log(`wrote ${join(outputDir, 'dossier.json')} (${dossier.length} bytes)`);
  console.log(`game/ and screenshots/ copied to ${outputDir}`);
}

main();
