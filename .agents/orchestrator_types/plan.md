# Plan — Vortex Strict Type Safety Enforcement

## Phase 1: Investigation and Setup (Current)
1. Initialize metadata files (`BRIEFING.md`, `progress.md`, `plan.md`).
2. Spawn an **Explorer** to run `npm run lint` and output the full list of files and lines with `@typescript-eslint/no-explicit-any` warnings, as well as `npm run build` to verify the current state.
3. Classify and group files with warnings into milestones.
4. Prepare `PROJECT.md` at the project root with the new architecture, milestones, and layout.

## Phase 2: Parallel Tracking (E2E Test Track & Implementation Track)
1. **E2E Testing Track**:
   - Spawn E2E Testing Orchestrator to ensure tests exist covering basic application boot and operations.
   - Design test scenarios to confirm app stability before, during, and after the refactoring.
   - Publish `TEST_READY.md`.
2. **Implementation Track**:
   - For each milestone group of warnings:
     - Spawn **Explorer** to analyze the warnings in specific files, draft proper types/interfaces, and prepare a strategy.
     - Spawn **Worker** to replace `any` with strict types/interfaces in the code and verify `npm run lint` and `npm run build` locally.
     - Spawn **Reviewer** to verify the correctness, completeness, and adherence to the TypeScript definitions.
     - Spawn **Challenger** to check for any runtime type failures or compile-time regressions.
     - Spawn **Forensic Auditor** to ensure no integrity violations (like `@ts-ignore` or other bypasses of type-checking) have been introduced.
     - Verify and pass gate criteria.

## Phase 3: Final Acceptance and Handover
1. Once all milestones are completed, run a final global verification (`npm run lint` and `npm run build`).
2. Hand over results to the parent Sentinel.
