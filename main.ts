// SOLMAR BAY — entry program (gta6-01, round 2).
// Hands the game in: copies game/ and screenshots/ to the output directory and
// writes dossier.json with buildDossier from vendor/makefun-game.ts.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
import { buildDossier } from "./vendor/makefun-game.ts";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyTree(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

async function main() {
  const gameDir = path.join(repoRoot, "game");
  const shotsDir = path.join(repoRoot, "screenshots");
  const outGame = path.join(outDir, "game");
  const outShots = path.join(outDir, "screenshots");
  fs.mkdirSync(outDir, { recursive: true });
  copyTree(gameDir, outGame);
  copyTree(shotsDir, outShots);
  // The scorer's own caps (reference/gate.json, as the starter's main.ts does): only
  // text_max_bytes shapes the bytes; the others refuse an entry the scorer would refuse
  // (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
  // of game files, or a path under game/ over 1000 bytes). buildDossier reads game/ and
  // screenshots/ from the output directory, so it runs after the copies above, and it
  // returns the dossier bytes (not a string).
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  fs.writeFileSync(path.join(outDir, "dossier.json"), dossier);
  console.log("wrote " + path.join(outDir, "dossier.json") + " (" + dossier.length + " bytes)");
}

main();
