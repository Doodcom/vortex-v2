# Original User Request

## 2026-06-24T15:59:56Z

Add six new major features to the existing Vortex Agentic V2 React/Electron app: Smart Disk & Cache Cleaner, Log Analysis & Auto-Remediation, Flatpak & AppImage Support, Cloud Sync for Dotfile Vault, Advanced BTRFS Maintenance, and Visual Docker Compose Builder.

Working directory: /home/doodcom/Documents/Vortex Agentic V2
Integrity mode: development

## Requirements

### R1. Smart Disk & Cache Cleaner
Build a new view and IPC handlers to analyze disk space used by system and application caches, integrating AI guidance to explain the cache contents before the user deletes them.

### R2. Log Analysis & Auto-Remediation
Create a Crash Diagnostics feature that fetches recent system error logs and uses the local Ollama AI to summarize root causes and propose actionable fixes.

### R3. Flatpak & AppImage Support
Extend the existing software/package management tools to natively support searching, installing, and managing Flatpak applications.

### R4. Cloud Sync for Dotfile Vault
Enhance the existing VaultView backup system with `rclone` integration to allow users to optionally sync their dotfile archives to a cloud provider.

### R5. Advanced BTRFS Maintenance
Implement a UI and backend commands to trigger and monitor BTRFS maintenance routines, such as scrub, balance, and deduplication.

### R6. Visual Docker Compose Builder
Design an interface to visually build Docker Compose configurations, and manage the resulting container lifecycle.

## Acceptance Criteria

### Agent-as-Judge Verification
- [ ] The team must run `npm run build` to ensure no TypeScript compilation errors exist.
- [ ] For each of the six features, an agent must launch or inspect the app to verify the UI correctly renders and the IPC handlers execute successfully without crashing the application.
- [ ] The new views must be accessible from the main app navigation/sidebar and fit seamlessly into the existing React architecture.

## Follow-up — 2026-06-24T16:30:01Z

Refactor the monolithic `electron/system.ts` file (which has grown to over 2,300 lines) into smaller, domain-specific modules to improve maintainability and architectural health.

Working directory: /home/doodcom/Documents/Vortex Agentic V2
Integrity mode: development

## Requirements

### R1. Modularize System Handlers
Extract logical groups of IPC handlers from `electron/system.ts` into dedicated files within the `electron/` directory (e.g., `system-docker.ts`, `system-packages.ts`, `system-btrfs.ts`, etc.). 

### R2. Centralize Registration
Update `electron/main.ts` (or create a new registrar module) to properly import and register all of the newly separated handler files on application startup, ensuring no functionality is lost.

### R3. Type Safety Preservation
Ensure that during the extraction, all necessary types and imports (like `ipcMain`, `execPromise`, etc.) are correctly included in the new files. Do not modify the actual business logic of the handlers, only their location.

## Acceptance Criteria

### Agent-as-Judge Verification
- [ ] The team must run `npm run build` after the refactor to guarantee there are no unresolved imports, missing variables, or TypeScript compilation errors.
- [ ] An agent must manually verify that at least a few major system functions (like Docker or Packages) still execute successfully in the application UI without IPC routing errors.

## 2026-06-24T21:12:58Z

Eradicate the `any` type warnings across the entire Vortex Agentic V2 codebase to ensure strict type safety. Currently, `npm run lint` reports over 650 instances of `@typescript-eslint/no-explicit-any`.

Working directory: /home/doodcom/Documents/Vortex Agentic V2
Integrity mode: development

## Requirements

### R1. Create Strict Interfaces
Analyze the objects currently typed as `any` (especially those returned from IPC handlers or ComfyUI API calls) and create strict TypeScript interfaces for them. 

### R2. Global Electron Types
Update `src/types/electron.d.ts` so that all IPC methods exposed to the `window.electron` object have proper argument and return types, rather than `any`.

### R3. Safe Component Props
Review React components in `src/components/` and `src/lib/comfyApi.ts` to ensure that their props and state variables use explicit types.

## Acceptance Criteria

### Agent-as-Judge Verification
- [ ] The team must run `npm run lint` continuously. The final victory condition requires the linter to report zero (0) `@typescript-eslint/no-explicit-any` errors.
- [ ] The team must run `npm run build` after fixing the types to guarantee that the stricter type definitions have not caused any compilation failures.
- [ ] An agent must manually verify that the application still boots successfully without type-related runtime crashes.
