import { spawn } from 'node:child_process';
import electronPath from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainPath = path.resolve(__dirname, '../../dist-electron/main.js');

console.log(`[Test Boot] Starting Electron dry-run...`);
console.log(`[Test Boot] Binary: ${electronPath}`);
console.log(`[Test Boot] Main: ${mainPath}`);

const args = [
  mainPath,
  '--no-sandbox',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-dev-shm-usage',
];

const child = spawn(electronPath, args, {
  stdio: 'pipe',
  env: {
    ...process.env,
  }
});

let exited = false;
let hasError = false;
const timeoutMs = 5000;

const timer = setTimeout(() => {
  if (!exited) {
    console.log(`[Test Boot] Electron survived the ${timeoutMs}ms boot window. Success!`);
    child.kill('SIGTERM');
    process.exit(0);
  }
}, timeoutMs);

child.stdout.on('data', (data) => {
  const line = data.toString();
  process.stdout.write(`[Electron stdout] ${line}`);
});

child.stderr.on('data', (data) => {
  const line = data.toString();
  process.stderr.write(`[Electron stderr] ${line}`);
  if (line.includes('Uncaught Exception') || line.includes('FATAL:') || line.includes('Error:')) {
    hasError = true;
  }
});

child.on('exit', (code, signal) => {
  exited = true;
  clearTimeout(timer);
  console.log(`[Test Boot] Electron exited with code: ${code}, signal: ${signal}`);
  if (hasError || (code !== null && code !== 0 && signal !== 'SIGTERM')) {
    console.error(`[Test Boot] Dry run failed!`);
    process.exit(code || 1);
  } else {
    console.log(`[Test Boot] Dry run finished successfully.`);
    process.exit(0);
  }
});
