# Project: Vortex Agentic V2 - Six Feature Expansion

## Architecture
- Electron main process (`electron/main.ts`) registers IPC handlers.
- Preload script (`electron/preload.ts`) exposes APIs to renderer via `contextBridge`.
- TypeScript typings in `src/types/electron.d.ts` must match preload APIs.
- React frontend in `src/` uses `App.tsx` for routing and `src/components/Sidebar.tsx` for navigation.
- Views are added as components and mapped in `App.tsx` `VIEW_MAP`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Explore & Design | Explorer analyzes the codebase and outputs a detailed implementation plan for all 6 features | None | PLANNED |
| 2 | R1: Smart Cleaner & R2: Crash Diagnostics | Implement Smart Disk & Cache Cleaner with AI guidance, and Log Analysis & Auto-Remediation with local Ollama | M1 | PLANNED |
| 3 | R3: Flatpak & R4: Cloud Vault Sync | Implement Flatpak package management, and rclone integration for Dotfile Vault backups | M2 | PLANNED |
| 4 | R5: BTRFS Maintenance & R6: Docker Compose | Implement BTRFS maintenance commands/UI, and visual Docker Compose builder with container lifecycle management | M3 | PLANNED |
| 5 | Integration & Verification | Run npm run build and verify all views render and run IPC handlers without crashing | M4 | PLANNED |

## Interface Contracts
- Detailed signatures for new IPC handlers will be defined after M1 analysis.
