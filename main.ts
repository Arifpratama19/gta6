// SOLMAR BAY — make.fun gta6-01 entry program (program/v1, Node 22, stdlib
// only). It copies game/ and screenshots/ from this repository into the
// output directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts, the kit's library, byte for byte. It runs twice
// and writes the same bytes both times: every file is copied in sorted
// order, nothing carries a timestamp, and the dossier is deterministic.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyTree(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  cpSync(srcDir, destDir, { recursive: true, dereference: false });
}

function main() {
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('game/index.html is missing: the game must ship its page');
  }
  if (!existsSync(shotsDir)) {
    throw new Error('screenshots/ is missing: the entry needs 3 or 4 screenshots');
  }

  // Start from a clean output directory so a stale file can never leak in.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  copyTree(gameDir, join(outDir, 'game'));
  copyTree(shotsDir, join(outDir, 'screenshots'));

  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`SOLMAR BAY: wrote ${outDir} (dossier ${dossier.length} bytes)`);
}

main();
