// Regression test runner (RULE 5).
// Transpiles the pure-logic libs with the repo's esbuild, then executes the
// node:test suite against them. Zero new dependencies.
//   node tests/run.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = mkdtempSync(join(tmpdir(), 'kss-regression-'));
const entries = ['errors', 'safeStorage', 'attendanceEngine'];

for (const name of entries) {
  const res = spawnSync(
    'npx',
    ['esbuild', `src/lib/${name}.ts`, '--bundle', '--format=cjs', '--platform=node', `--outfile=${join(OUT, `${name}.cjs`)}`],
    { stdio: 'inherit', shell: true }
  );
  if (res.status !== 0) {
    console.error(`[run] esbuild failed for ${name}`);
    process.exit(1);
  }
}

const testFiles = [
  join('tests', 'regression.test.mjs'), 
  join('tests', 'fcm.test.mjs'),
  join('tests', 'rtdb.test.mjs')
];

const testRes = spawnSync(
  process.execPath,
  ['--test', ...testFiles],
  { stdio: 'inherit', env: { ...process.env, KSS_TEST_OUT: OUT } }
);
process.exit(testRes.status ?? 1);
