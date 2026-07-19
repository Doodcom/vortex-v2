import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('Tier 2: Verifying build process...');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const build = spawn(npmCmd, ['run', 'build'], {
  cwd: projectRoot
});

build.on('error', (err) => {
  console.error(`FAIL: Failed to spawn build process "${npmCmd}": ${err.message}`);
  process.exit(1);
});

build.stdout.on('data', (data) => {
  process.stdout.write(data);
});

build.stderr.on('data', (data) => {
  process.stderr.write(data);
});

build.on('close', (code) => {
  console.log(`\nBuild process exited with code ${code}`);

  const requiredFiles = [
    path.join(projectRoot, 'dist/index.html'),
    path.join(projectRoot, 'dist-electron/main.js'),
    path.join(projectRoot, 'dist-electron/preload.js')
  ];

  let allExist = true;
  for (const file of requiredFiles) {
    const exists = existsSync(file);
    console.log(`Checking ${path.relative(projectRoot, file)}... ${exists ? 'EXISTS' : 'MISSING'}`);
    if (!exists) {
      allExist = false;
    }
  }

  if (code === 0 && allExist) {
    console.log('\nBuild verification PASSED.');
    process.exit(0);
  } else {
    console.error('\nBuild verification FAILED.');
    process.exit(1);
  }
});
