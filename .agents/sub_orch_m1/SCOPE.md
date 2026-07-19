# Scope: Foundational Electron & API Types

## Architecture
- Define strict typings for Electron IPC methods in `src/types/electron.d.ts` and API requests/responses in `src/lib/comfyApi.ts`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1.1 | TypeScript electron.d.ts Types | Resolve 17 @typescript-eslint/no-explicit-any warnings in `src/types/electron.d.ts` | None | DONE |
| 1.2 | TypeScript comfyApi.ts Types | Resolve 11 @typescript-eslint/no-explicit-any warnings in `src/lib/comfyApi.ts` | None | DONE |

## Interface Contracts
- Explicit typing of IPC channels and arguments in `src/types/electron.d.ts` rather than `any`.
- Proper JSON/record typing or specific object models in `src/lib/comfyApi.ts` instead of `any`.
