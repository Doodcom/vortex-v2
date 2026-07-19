import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('[Tier 4] Starting import sanity checks using esbuild...');

const srcDir = path.resolve(projectRoot, 'src');
const electronDir = path.resolve(projectRoot, 'electron');

function getFiles(dir, extensions) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath, extensions));
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

const filesToScan = [];
const appTsx = path.resolve(projectRoot, 'src/App.tsx');
if (fs.existsSync(appTsx)) filesToScan.push(appTsx);

const mainTsx = path.resolve(projectRoot, 'src/main.tsx');
if (fs.existsSync(mainTsx)) filesToScan.push(mainTsx);

const electronMain = path.resolve(projectRoot, 'electron/main.ts');
if (fs.existsSync(electronMain)) filesToScan.push(electronMain);

const electronPreload = path.resolve(projectRoot, 'electron/preload.ts');
if (fs.existsSync(electronPreload)) filesToScan.push(electronPreload);

filesToScan.push(...getFiles(path.resolve(projectRoot, 'src/components'), ['.ts', '.tsx', '.js', '.jsx']));
filesToScan.push(...getFiles(path.resolve(projectRoot, 'src/hooks'), ['.ts', '.tsx', '.js', '.jsx']));

// Unique file list
const uniqueFiles = Array.from(new Set(filesToScan));

let hasViolations = false;
let checkedCount = 0;

for (const file of uniqueFiles) {
  try {
    checkedCount++;
    await esbuild.build({
      entryPoints: [file],
      bundle: true,
      write: false,
      logLevel: 'silent',
      plugins: [
        {
          name: 'asset-stub',
          setup(build) {
            // Stub out CSS and assets
            build.onResolve({ filter: /\.(css|svg|png|jpg|jpeg|webp|gif|woff|woff2|ttf|eot)$/ }, args => {
              return { path: args.path, namespace: 'asset-stub-ns' };
            });
            build.onLoad({ filter: /.*/, namespace: 'asset-stub-ns' }, () => {
              return {
                contents: 'export default {};',
                loader: 'js',
              };
            });
          },
        },
        {
          name: 'path-resolve',
          setup(build) {
            // Resolve `@/` paths using esbuild's resolver
            build.onResolve({ filter: /^@\// }, async (args) => {
              const relativePath = args.path.substring(2);
              const targetPath = path.resolve(srcDir, relativePath);
              return build.resolve(targetPath, {
                resolveDir: path.dirname(args.importer),
                kind: args.kind,
              });
            });
          },
        },
        {
          name: 'external-resolver',
          setup(build) {
            // Mark all external packages (not starting with . or @/) and node builtins as external
            build.onResolve({ filter: /^[^.@]/ }, args => {
              if (!path.isAbsolute(args.path)) {
                return { path: args.path, external: true };
              }
            });
            build.onResolve({ filter: /^@[^\/]/ }, args => {
              return { path: args.path, external: true };
            });
          }
        }
      ],
    });
  } catch (err) {
    console.error(`[Tier 4] Error resolving imports in ${path.relative(projectRoot, file)}:`);
    if (err.errors) {
      for (const e of err.errors) {
        console.error(`  ${e.text}`);
        if (e.location) {
          console.error(`    at ${e.location.file}:${e.location.line}:${e.location.column}`);
        }
      }
    } else {
      console.error(err);
    }
    hasViolations = true;
  }
}

console.log(`[Tier 4] Scanned ${checkedCount} entry files.`);

if (hasViolations) {
  console.error('[Tier 4] Fail: Broken imports detected.');
  process.exit(1);
} else {
  console.log('[Tier 4] Pass: All local imports resolved successfully.');
  process.exit(0);
}
