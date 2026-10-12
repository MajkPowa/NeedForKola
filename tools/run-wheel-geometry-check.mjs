/** Capture complete, fresh wheel QA evidence, including failed checks.
 * node tools/run-wheel-geometry-check.mjs --json-only --report=docs/qa/wheel-fidelity-live-geometry-2026-10-12.json
 * node tools/run-wheel-geometry-check.mjs --export-parity-only --report=docs/qa/wheel-fidelity-export-parity-2026-10-12.json
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv.slice(2);
const reportOption = input.find(value => value.startsWith('--report='));
if (!reportOption?.slice(9)) throw new Error('An explicit --report=path is required.');
const forwarded = input.filter(value => value !== reportOption);
const reportPath = path.resolve(root, reportOption.slice(9));
const logBase = reportPath.replace(/\.json$/i, '');
const stdoutPath = logBase + '.stdout.log';
const stderrPath = logBase + '.stderr.log';
const relative = filename => path.relative(root, filename).replaceAll('\\', '/');
const digest = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const selected = new Set((forwarded.find(value => value.startsWith('--models='))?.slice(9) || '').split(',').filter(Boolean));

function snapshot() {
  const files = [
    'tools/check-wheel-reconstruction-geometry.mjs',
    'js/wheel-reconstruction.js',
    'js/wheel-brand-cap.js',
    'assets/vendor/three/three.module.js',
    'assets/vendor/meshoptimizer/meshopt_decoder.mjs',
  ];
  if (!forwarded.includes('--fixtures-only')) {
    const index = JSON.parse(fs.readFileSync(path.join(root, 'assets/wheel-models/index.json'), 'utf8'));
    files.push('assets/wheel-models/index.json');
    for (const entry of index.models) {
      if (!selected.size || selected.has(entry.id)) files.push(entry.record);
    }
  }
  return Object.fromEntries(files.map(filename => [filename, digest(path.join(root, filename))]));
}

const startedAt = new Date().toISOString();
const before = snapshot();
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const stdout = fs.createWriteStream(stdoutPath, { flags: 'w' });
const stderr = fs.createWriteStream(stderrPath, { flags: 'w' });
let spawnError;
const checkerPath = path.join(root, 'tools/check-wheel-reconstruction-geometry.mjs');
const child = spawn(process.execPath, [checkerPath, ...forwarded], { cwd: root, windowsHide: true });
child.stdout.pipe(stdout); child.stderr.pipe(stderr);
child.on('error', error => { spawnError = error; });
const exit = await new Promise(resolve => child.on('close', (code, signal) => resolve({ code, signal })));
await Promise.all([stdout, stderr].map(stream => new Promise((resolve, reject) => {
  if (stream.writableFinished) resolve();
  else { stream.once('finish', resolve); stream.once('error', reject); }
})));

const stdoutText = fs.readFileSync(stdoutPath, 'utf8').trim();
const stderrText = fs.readFileSync(stderrPath, 'utf8').trim();
let report;
for (const candidate of exit.code === 0 ? [stdoutText, stderrText] : [stderrText, stdoutText]) {
  try {
    const parsed = JSON.parse(candidate);
    if (['PASS', 'FAIL'].includes(parsed.status)) { report = parsed; break; }
  } catch { /* Node startup failures still receive a real FAIL report below. */ }
}
report ||= { status: 'FAIL', message: spawnError?.message || 'The checker did not emit a complete JSON result.',
  stderrTail: stderrText.slice(-4000), stdoutTail: stdoutText.slice(-4000) };
let after;
try { after = snapshot(); }
catch (error) { report = { ...report, status: 'FAIL', evidenceFailure: error.message }; }
const inputsStable = Boolean(after) && JSON.stringify(before) === JSON.stringify(after);
if (!inputsStable) report = { ...report, status: 'FAIL', evidenceFailure: 'Geometry inputs changed during the check.' };
if (exit.code !== 0 && report.status === 'PASS') report = { ...report, status: 'FAIL', evidenceFailure: 'The checker exited unsuccessfully.' };
report.evidence = {
  freshRun: true, startedAt, completedAt: new Date().toISOString(),
  command: ['node', relative(checkerPath), ...forwarded],
  sourceCheckExitCode: exit.code, terminationSignal: exit.signal,
  inputsStable, inputSha256: before,
  stdoutLog: relative(stdoutPath), stderrLog: relative(stderrPath),
};
// A completed result atomically replaces previous evidence; UTF-8 has no BOM.
const temporaryPath = reportPath + '.' + process.pid + '.tmp';
fs.writeFileSync(temporaryPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
fs.renameSync(temporaryPath, reportPath);
console.log(JSON.stringify({ status: report.status, report: relative(reportPath),
  models: report.catalogue?.models, failures: report.catalogue?.failures,
  assertions: report.assertions, inputsStable, exitCode: exit.code }, null, 2));
process.exitCode = report.status === 'PASS' && exit.code === 0 ? 0 : 1;
