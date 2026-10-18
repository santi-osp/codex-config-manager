/**
 * Cross-platform test runner executing Unit, Security, and E2E suites.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const suites = [
  { name: 'Unit Suite (TOML Engine Surgical Round-Trip)', script: 'tests/toml-engine.test.mjs' },
  { name: 'Static i18n & Translation Quality Suite', script: 'tests/i18n-static.test.mjs' },
  { name: 'Security & Hardening Suite', script: 'tests/security.test.mjs' },
  { name: 'Real Disk Persistence & Recovery E2E Suite', script: 'tests/e2e-disk-persistence.test.mjs' },
  { name: 'Playwright Synthetic UI Demo E2E Suite', script: 'tests/e2e.test.mjs' },
  { name: 'Playwright Bilingual i18n E2E Suite', script: 'tests/e2e-i18n.test.mjs' }
];

async function runSuite({ name, script }) {
  console.log(`\n================================================================`);
  console.log(` RUNNING: ${name}`);
  console.log(`================================================================\n`);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(REPO_ROOT, script)], {
      stdio: 'inherit',
      cwd: REPO_ROOT,
      env: { ...process.env }
    });

    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Suite "${name}" failed with exit code ${code}`));
      }
    });
  });
}

async function main() {
  const startTime = Date.now();
  for (const suite of suites) {
    try {
      await runSuite(suite);
    } catch (err) {
      console.error(`\n❌ ${err.message}`);
      process.exit(1);
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n================================================================`);
  console.log(` ✅ ALL TEST SUITES PASSED CLEANLY (${durationSec}s)`);
  console.log(`================================================================\n`);
}

main();
