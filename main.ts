// Entry point for the token launch radar (token-radar-01). Node's standard library only.
//
// What one run does, in order:
//   1. reads the sealed snapshot (default /input/snapshot.json, override with --input),
//   2. scores it with the model in lib/model.ts and refuses to hand in a board the gate
//      would refuse (boardIssue says why, in words),
//   3. writes board.json and the dashboard's data.js into the output directory
//      (default /output, or $MAKEFUN_OUTPUT_DIR, or --output),
//   4. copies this repository's dashboard/ and screenshots/ beside them,
//   5. writes dossier.json last, with the vendored buildDossier, because the scorer
//      rebuilds that file from the finished output and compares it byte for byte.
//
// Local run:  MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));

/** Stop the run with the reason on stderr; a radar that cannot score must not hand in paper. */
function fail(message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(1);
}

/** The value after `--name` in the arguments (or `--name=value`), else the fallback. */
function option(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && process.argv[at + 1] !== undefined) return process.argv[at + 1]!;
  const joined = process.argv.find((a) => a.startsWith(`--${name}=`));
  return joined === undefined ? fallback : joined.slice(name.length + 3);
}

const inputArg = option('input', '/input');
const snapshotPath = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(snapshotPath)) {
  fail(`no snapshot at ${snapshotPath}: pass --input <snapshot.json|directory> or mount the sealed /input`);
}
const outDir = option('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) fail(`the model wrote a board the gate refuses: ${issue}`);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outDir, 'data.js'), dataScript(radar));

/**
 * Copy a folder's regular files into the output, skipping dot-names. Returns the names
 * copied, in directory order; a missing folder copies nothing.
 */
function copyFolder(name: string): string[] {
  const from = join(repoDir, name);
  if (!existsSync(from)) return [];
  const to = join(outDir, name);
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const entry of readdirSync(from)) {
    if (entry.startsWith('.')) continue;
    if (!statSync(join(from, entry)).isFile()) continue;
    copyFileSync(join(from, entry), join(to, entry));
    copied.push(entry);
  }
  return copied;
}

copyFolder('dashboard');
const shots = copyFolder('screenshots');
if (shots.length < 3) {
  fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
}
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
}

// The gate's own caps, handed to the dossier builder so what it writes is what the scorer rebuilds.
const dossier = buildDossier(outDir, {
  text_max_bytes: 65_536,
  screenshots: { max: 4, max_bytes: 524_288 },
  dashboard: { max_files: 400, max_bytes: 4_194_304 },
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ` +
  `${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
  `token radar: wrote board.json, data.js, dashboard/, screenshots/ (${shots.length} images) and dossier.json under ${outDir}\n`,
);
