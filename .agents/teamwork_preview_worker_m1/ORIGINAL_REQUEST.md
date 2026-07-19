## 2026-06-24T21:18:07Z
You are a teamwork_preview_worker. Your working directory is /home/doodcom/Documents/Vortex Agentic V2/.agents/teamwork_preview_worker_m1.
Your role is E2E Test Suite Creator.

Your mission is to implement a comprehensive, 4-tier E2E and sanity testing suite for the Vortex Strict Type Safety Enforcement project.
Here is the step-by-step instruction:

1. Create a directory named `tests/` at the project root.
2. Inside `tests/`, implement the following files:
   - `tests/check-no-explicit-any.js` (Tier 1): Run ESLint on "src/**/*.{ts,tsx}" and "electron/**/*.ts", overriding the rule to error: `--rule "@typescript-eslint/no-explicit-any: error" --format json`. Parse the JSON output. If any files contain '@typescript-eslint/no-explicit-any' violations, log each file path and violation line/column, and exit with code 1. If none, exit 0.
   - `tests/verify-build.js` (Tier 2): Execute `npm run build` (which runs `tsc -b && vite build`) as a child process. Log the output. Check that the build output files exist: `dist/index.html`, `dist-electron/main.js`, and `dist-electron/preload.js`. Exit 0 on success, 1 on failure.
   - `tests/test-boot.js` (Tier 3): Launch Electron using the compiled `dist-electron/main.js` as a child process. Pass the `--dry-run`, `--no-sandbox`, `--disable-gpu`, `--disable-software-rasterizer`, and `--disable-dev-shm-usage` arguments. Wait for the process to exit. If it exits with 0, or signal SIGTERM (in case of fallback), it passes. If it outputs uncaught exception or fatal errors, or exits with non-zero, it fails. Implement a fallback survival timer of 5000ms: if the process doesn't exit after 5 seconds but outputs no errors, SIGTERM it and count it as success. On Linux, if DISPLAY environment variable is missing, check if `xvfb-run` is available and run it under `xvfb-run --auto-servernum`, or warn the user.
   - `tests/import-check.js` (Tier 4): Use `esbuild` to verify typescript imports. Scan `src/App.tsx`, `src/main.tsx`, `electron/main.ts`, `electron/preload.ts`, and all files in `src/components/` and `src/hooks/`. Configure esbuild to build each file in-memory (`bundle: true, write: false`), marking Electron and external node modules (like better-sqlite3, systeminformation, framer-motion, react, react-dom, axios, lucide-react, react-markdown, etc.) as `external`. Use a custom resolver plugin to stub out all asset imports (.css, images, svg, etc.) with `export default {}`. Exit 0 if all files resolve and compile successfully, 1 otherwise.
   - `tests/run-all.js` (Test Runner): Run the above four test scripts sequentially. Format the output nicely, listing the pass/fail status of each tier. Exit 0 if all tiers pass, or 1 if any tier fails.

3. Edit `electron/main.ts` to implement the dry-run CLI argument support:
   Inside `app.whenReady().then(...)`, intercept the `--dry-run` CLI argument. If `process.argv.includes('--dry-run')` is true, log a dry-run confirmation message, call `app.quit()`, and return immediately to prevent creating Windows or Tray elements.

4. Create `tsconfig.electron.json` in the project root to include the `electron` folder in compilation. It should target ES2023, module resolution "bundler", and include "electron" in the `include` array.
5. Modify the root `tsconfig.json` to include `{ "path": "./tsconfig.electron.json" }` in its `references` array, ensuring `electron/**/*.ts` is type-checked by `tsc -b`.

6. Modify `package.json` to add a script: `"test:e2e": "node tests/run-all.js"`.

7. Create `TEST_INFRA.md` in the project root outlining the testing architecture, onboarding/prerequisites, testing levels (Tiers 1-4), and mocking strategies. Follow the E2E Testing Track Principles and template.

8. Create `TEST_READY.md` in the project root outlining how to invoke the test runner, which files are checked, and summarizing the test coverage.

9. Run the full test suite using `npm run test:e2e` to verify the runner executes correctly. Note: since the codebase currently contains numerous `no-explicit-any` errors, Tier 1 is expected to fail. Verify that this failure is correctly reported by the test runner.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

When completed, write a handoff.md report summarizing the changes made, paths of created files, and the output of running `npm run test:e2e`. Send a message back to the parent (conversation ID: 730daffe-b6f7-47c5-8a55-92f8801cf942) with the details.
