# Plan - Sanity Checks and Milestone Transition

## Step 1: Verification of Build and Lint Status
- Run `npm run build` in `/home/doodcom/Documents/Vortex Agentic V2`.
- Run `npm run lint` in `/home/doodcom/Documents/Vortex Agentic V2`.
- Document errors and check if build fails because of `src/components/temp-false-positive-test.tsx`, `src/components/temp-import-test.tsx`, or any other temporary files.

## Step 2: Remove or Fix Problematic Files
- If the build fails because of `src/components/temp-false-positive-test.tsx` or `src/components/temp-import-test.tsx` or any other files, delete those files (or fix them) so that `npm run build` succeeds.
- Re-run `npm run build` to verify success.

## Step 3: Update PROJECT.md
- Set the status of Milestone 1 and Milestone 2 to `DONE` (confirming they are DONE).
- Set the status of Milestone 3 to `IN_PROGRESS`.
- Verify the file matches.

## Step 4: Run ESLint on Milestones 1 & 2 Files
- Run ESLint explicitly on the following files:
  - `src/types/electron.d.ts`
  - `src/lib/comfyApi.ts`
  - `src/hooks/useComfySocket.ts`
  - `src/hooks/useOllama.ts`
- Verify they have 0 warnings/errors for `@typescript-eslint/no-explicit-any`.

## Step 5: Final Documentation & Orchestrator Message
- Write `handoff.md` inside `.agents/worker_setup_sanity/`.
- Send a message to orchestrator with conversation ID: 83f531e1-6cc2-4bc8-beea-af8bfcbaae30.
