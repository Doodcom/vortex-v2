import { spawn } from 'node:child_process';
import path from 'node:path';

const tests = [
  { name: 'Tier 1: Lint Checks', script: 'tests/check-no-explicit-any.js' },
  { name: 'Tier 4: Import Sanity Checks', script: 'tests/import-check.js' },
  { name: 'Tier 2: Compilation/Build Checks', script: 'tests/verify-build.js' },
  { name: 'Tier 3: Boot Dry-Run Verification', script: 'tests/test-boot.js' }
];

async function runTest(test) {
  console.log('\n========================================');
  console.log(`Running ${test.name}`);
  console.log('========================================');

  return new Promise((resolve) => {
    const child = spawn('node', [test.script], { stdio: 'inherit' });
    child.on('error', (err) => {
      console.error(`FAIL: Failed to spawn test script "${test.script}": ${err.message}`);
      resolve(false);
    });
    child.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

async function runAll() {
  const allowFailure = process.argv.includes('--allow-failure');
  let allPass = true;
  const results = [];

  for (const test of tests) {
    const passed = await runTest(test);
    results.push({ name: test.name, passed });
    if (!passed) {
      allPass = false;
      if (!allowFailure) {
        console.log(`\n[Runner] Test failed: ${test.name}. Aborting.`);
        break;
      }
    }
  }

  console.log('\n========================================');
  console.log('E2E Test Suite Results Summary');
  console.log('========================================');
  for (const res of results) {
    console.log(`${res.passed ? '✓' : '✗'} ${res.name}`);
  }
  console.log('========================================');

  if (allPass) {
    console.log('[Runner] All tests passed!');
    process.exit(0);
  } else {
    console.error('[Runner] One or more tests failed.');
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error('[Runner] Unexpected error:', err);
  process.exit(1);
});
