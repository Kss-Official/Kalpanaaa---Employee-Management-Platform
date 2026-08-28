// Regression test runner (RULE 5).
// Transpiles the pure-logic libs with the repo's esbuild, then executes the
// node:test suite against them. Zero new dependencies.
//   node tests/run.mjs
import esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = mkdtempSync(join(tmpdir(), 'kss-regression-'));
const entries = ['errors', 'safeStorage', 'attendanceEngine', 'hierarchy'];

for (const name of entries) {
  esbuild.buildSync({
    entryPoints: [`src/lib/${name}.ts`],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile: join(OUT, `${name}.cjs`)
  });
}

const testFiles = [
  join('tests', 'regression.test.mjs'),
  join('tests', 'fcm.test.mjs'),
  join('tests', 'rtdb.test.mjs'),
  join('tests', 'hierarchy.test.mjs')
];

const testRes = spawnSync(
  process.execPath,
  ['--test', ...testFiles],
  { stdio: 'inherit', env: { ...process.env, KSS_TEST_OUT: OUT } }
);
process.exit(testRes.status ?? 1);
