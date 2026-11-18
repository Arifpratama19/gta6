// main.ts — SOLMAR BAY's entry program for make.fun gta6-01.
// It copies game/ and screenshots/ from this repository to the output
// directory and writes /output/dossier.json with buildDossier from the
// kit's vendor/makefun-game.ts. Node 22 standard library only; the two
// grader runs must write identical bytes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
copyTree(path.join(here, 'game'), path.join(outDir, 'game'));
copyTree(path.join(here, 'screenshots'), path.join(outDir, 'screenshots'));

const dossier = buildDossier(outDir, caps);
fs.writeFileSync(path.join(outDir, 'dossier.json'), dossier);
console.log(`wrote ${path.join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
