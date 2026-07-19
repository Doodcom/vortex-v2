import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('Tier 1: Checking for explicit "any" types via ESLint...');

const completedFiles = [
  'src/types/electron.d.ts',
  'src/App.tsx',
  'src/components/CleanerView.tsx',
  'src/components/DashboardView.tsx',
  'src/components/SettingsPage.tsx',
  'src/components/Sidebar.tsx',
  'src/components/StatusBar.tsx',
  'src/components/WindowControls.tsx'
];

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const eslint = spawn(npxCmd, [
  'eslint',
  ...completedFiles,
  '--rule',
  '@typescript-eslint/no-explicit-any:error',
  '--format',
  'json'
], {
  cwd: projectRoot
});

let stdout = '';
let stderr = '';

eslint.on('error', (err) => {
  console.error(`FAIL: Failed to spawn ESLint process "${npxCmd}": ${err.message}`);
  process.exit(1);
});

eslint.stdout.on('data', (data) => {
  stdout += data;
});

eslint.stderr.on('data', (data) => {
  stderr += data;
});

eslint.on('close', (code) => {
  if (stderr.trim()) {
    console.error('ESLint stderr:', stderr);
  }

  if (!stdout.trim()) {
    if (code !== 0) {
      console.error(`ESLint exited with code ${code} and produced no JSON output.`);
      process.exit(1);
    }
    console.error('No output from ESLint. Code:', code);
    process.exit(1);
  }

  try {
    const results = JSON.parse(stdout);
    let violationCount = 0;
    let parserErrorCount = 0;
    
    const migratedFiles = new Set([
      'src/types/electron.d.ts',
      'src/App.tsx',
      'src/components/CleanerView.tsx',
      'src/components/DashboardView.tsx',
      'src/components/SettingsPage.tsx',
      'src/components/Sidebar.tsx',
      'src/components/StatusBar.tsx',
      'src/components/WindowControls.tsx'
    ]);

    for (const file of results) {
      const relativePath = path.relative(projectRoot, file.filePath);
      
      // Check for parsing/syntax errors
      const parserErrors = file.messages.filter(
        (msg) => msg.fatal || msg.ruleId === null || (msg.message && msg.message.startsWith('Parsing error'))
      );
      
      if (parserErrors.length > 0) {
        console.error(`\n[Parser Error] File: ${relativePath}`);
        for (const msg of parserErrors) {
          console.error(`  Line ${msg.line}, Col ${msg.column}: ${msg.message}`);
          parserErrorCount++;
        }
      }

      const violations = file.messages.filter(
        (msg) => msg.ruleId === '@typescript-eslint/no-explicit-any'
      );
      
      if (violations.length > 0) {
        const isMigrated = migratedFiles.has(relativePath);
        if (isMigrated) {
          console.log(`\n[Migrated File Violation] File: ${relativePath}`);
          for (const msg of violations) {
            console.log(`  Line ${msg.line}, Col ${msg.column}: ${msg.message}`);
            violationCount++;
          }
        } else {
          // Log as a warning for planned/unmigrated milestones
          console.log(`[Planned Milestone Warning] File: ${relativePath} (${violations.length} explicit 'any' warnings)`);
        }
      }
    }

    if (parserErrorCount > 0) {
      console.error(`\nFound ${parserErrorCount} ESLint parser/syntax errors.`);
      process.exit(1);
    }

    if (violationCount > 0) {
      console.log(`\nFound ${violationCount} '@typescript-eslint/no-explicit-any' violations in migrated files.`);
      process.exit(1);
    }

    console.log('\nNo explicit "any" violations found in migrated Milestone 1, 2, and 3 files.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to parse ESLint JSON output:', err);
    console.error('Stdout was:', stdout);
    process.exit(1);
  }
});
