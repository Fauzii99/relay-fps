// relay-fps-entry / main.ts — hands the game in.
//
// Node 22, standard library only. The game itself is plain static files under game/ that the
// browser loads as ES modules through one import map, so there is nothing to bundle or install.
// This program does three things, deterministically, twice, with identical bytes:
//   1. copies game/ and screenshots/ beside this file into the output directory,
//   2. checks the vendored three.js 0.187.0 pair is byte for byte the build the kit ships,
//   3. writes dossier.json with the kit's own buildDossier, the summary the judge reads.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// sha256 of the two files three.js 0.187.0 ships in game/vendor/three/, as the kit lists them.
// A mismatch means the module pair drifted from the version the bounty requires, so it refuses
// to hand in a game the gate would reject anyway.
const THREE_SHA = {
  'three.module.min.js': 'ef510bae547ab3789d6ed543333a8bf42510a8c70743b766c4e19039b976c26b',
  'three.core.min.js': '613e370f76638fdef83926642bf256dc9615684922de1ce1f63a8583e5d78578',
};

const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');

for (const [file, want] of Object.entries(THREE_SHA)) {
  const path = join(here, 'game', 'vendor', 'three', file);
  if (!existsSync(path)) throw new Error(`main.ts: game/vendor/three/${file} is missing`);
  const got = sha256(path);
  if (got !== want) throw new Error(`main.ts: game/vendor/three/${file} is not three.js 0.187.0 (sha256 ${got})`);
}

// The screenshots are copied by name in code-unit order, so the cover (the first by name) is the
// same file on every run and on every machine.
const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir)
      .filter((name) => !name.startsWith('.') && /\.(png|jpe?g)$/i.test(name))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`main.ts: screenshots/ must hold 3 or 4 PNG or JPEG files, found ${shots.length}`);
}

rmSync(join(out, 'game'), { recursive: true, force: true });
rmSync(join(out, 'screenshots'), { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
for (const name of shots) cpSync(join(shotsDir, name), join(out, 'screenshots', name));

// The scorer's own caps (reference/gate.json): text_max_bytes shapes the dossier's text, the rest
// refuse an entry the scorer would refuse — more than 4 screenshots or one over 256 KiB, more than
// 993 files or 48 MiB inside game/.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
if (dossier.byteLength > 1572864) throw new Error('dossier exceeds the 1.5 MiB competition cap');
writeFileSync(join(out, 'dossier.json'), dossier);

// A short, honest receipt on stdout, so a run can be checked without trusting the exit code.
const gameFiles: string[] = [];
const walk = (dir: string): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else gameFiles.push(full);
  }
};
walk(join(out, 'game'));
const gameBytes = gameFiles.reduce((sum, file) => sum + statSync(file).size, 0);
console.log(`main.ts: game ${gameFiles.length} files ${gameBytes} bytes, screenshots ${shots.length} [${shots.join(', ')}], dossier ${dossier.byteLength} bytes`);
