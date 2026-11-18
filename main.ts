// SOLMAR BAY — make.fun gta6-01 entrypoint (Node 22, standard library only).
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with the kit's buildDossier, so
// the gate can rebuild the dossier byte for byte and compare.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function copyTree(name) {
  const src = join(REPO, name);
  const dst = join(OUT, name);
  if (!existsSync(src)) throw new Error(`missing ${name}/ in repository`);
  rmSync(dst, { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });
  // Copy in sorted order so the two program runs produce identical bytes.
  const entries = readdirSync(src, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const entry of entries) {
    cpSync(join(src, entry.name), join(dst, entry.name), { recursive: true });
  }
}

mkdirSync(OUT, { recursive: true });
copyTree('game');
copyTree('screenshots');
const dossier = buildDossier(OUT, CAPS);
writeFileSync(join(OUT, 'dossier.json'), dossier);
console.log(`SOLMAR BAY dossier written: ${dossier.length} bytes -> ${join(OUT, 'dossier.json')}`);
