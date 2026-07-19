## 2026-06-24T16:32:15Z
You are a worker subagent. Your task is to implement Milestone 1: Create `electron/system-common.ts` containing the shared imports and helpers.
Your working directory is: `/home/doodcom/Documents/Vortex Agentic V2/.agents/worker_milestone1` (please create it and write metadata/coordination files only here).
Your mission:
1. Create `electron/system-common.ts` in the workspace.
2. In `system-common.ts`, include the necessary imports:
   - `exec`, `spawn` from `child_process`
   - `promisify` from `util`
   - `db` from `./db` (re-exported)
3. Implement and export `execPromise` as `promisify(exec)`.
4. Implement and export `detectAurHelper`.
5. Implement and export `createSystemHelpers(win: any)` which returns `notify`, `streamLog`, and `runStreamingCmd` scoped to the window `win`. Ensure `notify`, `streamLog`, and `runStreamingCmd` are exactly copied from `electron/system.ts` to preserve their exact functionality and type safety.
6. Verify your implementation compiles by running a build or type check (`npm run build` or similar) in the workspace directory `/home/doodcom/Documents/Vortex Agentic V2`.
7. Once successfully created and verified, write your handoff report to `/home/doodcom/Documents/Vortex Agentic V2/.agents/worker_milestone1/handoff.md` and send a message back to the parent orchestrator.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
