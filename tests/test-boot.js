import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('Tier 3: Testing Electron application boot (dry-run)...');

// Check display / xvfb-run on Linux
let useXvfb = false;
if (process.platform === 'linux' && !process.env.DISPLAY) {
  try {
    execSync('which xvfb-run', { stdio: 'ignore' });
    useXvfb = true;
    console.log('Linux DISPLAY is missing. Found xvfb-run. Running with xvfb-run --auto-servernum...');
  } catch (e) {
    console.warn('WARNING: Linux DISPLAY environment variable is missing and xvfb-run is not available. Boot check might fail.');
  }
}

const electronArgs = [
  'dist-electron/main.js',
  '--dry-run',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-dev-shm-usage'
];

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
let cmd = npxCmd;
let args = ['electron', ...electronArgs];

if (useXvfb) {
  cmd = 'xvfb-run';
  args = ['--auto-servernum', npxCmd, 'electron', ...electronArgs];
}

console.log(`Executing: ${cmd} ${args.join(' ')}`);

const child = spawn(cmd, args, {
  cwd: projectRoot
});

let stdout = '';
let stderr = '';
let hasErrorOutput = false;

child.on('error', (err) => {
  console.error(`FAIL: Failed to spawn process "${cmd}": ${err.message}`);
  process.exit(1);
});

child.stdout.on('data', (data) => {
  const str = data.toString();
  stdout += str;
  process.stdout.write(data);
  if (/uncaught\s*exception|fatal\s*error/i.test(str)) {
    hasErrorOutput = true;
  }
});

child.stderr.on('data', (data) => {
  const str = data.toString();
  stderr += str;
  process.stderr.write(data);
  if (/uncaught\s*exception|fatal\s*error/i.test(str)) {
    hasErrorOutput = true;
  }
});

let timerExceeded = false;
const timer = setTimeout(() => {
  console.log('\nSurvival timer of 5000ms expired. Terminating process...');
  timerExceeded = true;
  child.kill('SIGTERM');
}, 5000);

child.on('close', (code, signal) => {
  clearTimeout(timer);
  console.log(`\nElectron boot process finished. Exit code: ${code}, Signal: ${signal}`);

  if (timerExceeded) {
    console.error('FAIL: Electron boot check timed out (exceeded 5000ms).');
    process.exit(1);
  }

  if (hasErrorOutput) {
    console.error('FAIL: Uncaught exception or fatal error output detected.');
    process.exit(1);
  }

  const dryRunConfirmed = stdout.includes('[Main] Dry-run confirmation: --dry-run detected. Exiting now.') ||
                          stderr.includes('[Main] Dry-run confirmation: --dry-run detected. Exiting now.');

  if (!dryRunConfirmed) {
    console.error('FAIL: Dry-run confirmation message "[Main] Dry-run confirmation..." was not found in output.');
    process.exit(1);
  }

  if (code === 0) {
    console.log('Electron boot check PASSED.');
    process.exit(0);
  } else {
    console.error('FAIL: Electron boot check exited with non-zero code or signal.');
    process.exit(1);
  }
});
