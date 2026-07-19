## 2026-06-25T02:50:00Z
You are a teamwork_preview_worker. Your working directory is /home/doodcom/Documents/Vortex Agentic V2/.agents/teamwork_preview_worker_m1_gen3.
Your role is E2E Test Suite Creator.

Your mission is to fix and refine the E2E testing suite for the Vortex Strict Type Safety Enforcement project based on Reviewer and Challenger feedback.
Here are the issues you must address:

1. **Tier 4 (Import Check) using esbuild**:
   Rewrite `tests/import-check.js` to use `esbuild` to verify typescript imports. Do not use raw regex matching.
   - Scan `src/App.tsx`, `src/main.tsx`, `electron/main.ts`, `electron/preload.ts`, and all files in `src/components/` and `src/hooks/`.
   - Configure esbuild to build each file in-memory (`bundle: true, write: false`), marking Electron and external node modules (like `better-sqlite3`, `systeminformation`, `framer-motion`, `react`, `react-dom`, `axios`, `lucide-react`, `react-markdown`, `canvas-confetti`, etc., or reading the dependencies from package.json) as `external`.
   - Use a custom resolver plugin to stub out all asset imports (.css, images, svg, etc.) with `export default {}`.
   - Exit 0 if all files resolve and compile successfully, 1 otherwise.

2. **Tier 3 (Boot Check) Timeout / Stall Handling**:
   - In `tests/test-boot.js`, if the Electron process times out (exceeds the 5000ms survival timer) without exiting on its own, it must be treated as a **failure** (exit 1), not a pass. The dry-run should exit immediately on boot. If it takes more than 5 seconds, it has stalled.
   - Ensure the boot check verifies that the process outputs dry-run confirmation `[Main] Dry-run confirmation: --dry-run detected. Exiting now.`.

3. **Tier 1 (Lint Check) Parser Errors**:
   - In `tests/check-no-explicit-any.js`, make sure the script does not ignore ESLint parsing/syntax errors. If ESLint exits with a non-zero code due to compilation/parsing errors, the script must report this and exit with 1.

4. **Child Process Error Handling**:
   - In all test scripts, ensure all spawned child processes have `.on('error', (err) => { ... })` handlers to log errors and exit with 1, rather than crashing the suite runner if a command is missing.

5. **Cross-Platform Compatibility**:
   - Use `process.platform === 'win32'` checks for spawning commands (like `npm` -> `npm.cmd`, `npx` -> `npx.cmd`) to make execution cross-platform.

6. **Documentation & Layout**:
   - Verify `TEST_INFRA.md` and `TEST_READY.md` align perfectly with the updated code behavior.
   - Ensure `tsconfig.electron.json` is configured properly.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

When completed, run the E2E test runner via `npm run test:e2e -- --allow-failure`, write a handoff.md report summarizing the changes made, paths of modified/created files, and the output of running the tests. Send a message back to the parent (conversation ID: 6ea9f939-df0d-4450-b46b-73fc7c1e9dd5) with the details.
