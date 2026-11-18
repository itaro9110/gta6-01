// main.ts — the entrypoint that hands SOLMARA in to make.fun.
// It copies game/ and screenshots/ from this repository into the
// output directory (/output, or MAKEFUN_OUTPUT_DIR outside the grader)
// and writes /output/dossier.json with buildDossier from the kit's
// vendor/makefun-game.ts. Node 22, standard library only. It runs
// twice and writes the same bytes both times: the copy is a plain
// byte-for-byte copy in sorted order, and the dossier is deterministic.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = process.cwd();
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// Start from an empty output directory so a stale file can never leak in.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// The game: every static file under game/.
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });

// The screenshots: 4 real renders of the game's own code.
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The dossier: byte for byte what the kit's library writes from the
// output directory itself, under the competition's caps.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`SOLMARA handed in: ${outDir} (dossier ${dossier.length} bytes)`);
