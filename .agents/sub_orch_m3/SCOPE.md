# Scope: Milestone 3 — Core Layout & App Views

## Architecture
- This milestone focuses on the core React layout and view components of the application.
- Target files:
  - `src/App.tsx` (App entry and view router)
  - `src/components/AssistantView.tsx` (AI Chat interface)
  - `src/components/CleanerView.tsx` (System cleanup utility)
  - `src/components/DashboardView.tsx` (Status dashboard)
  - `src/components/HomeView.tsx` (Welcome page)
  - `src/components/SettingsPage.tsx` (Configuration page)
  - `src/components/Sidebar.tsx` (Main navigation menu)
  - `src/components/StatusBar.tsx` (Bottom system status indicator)
  - `src/components/WindowControls.tsx` (Window minimize/maximize/close buttons)

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 3.1 | Core App & Views type safety | Resolve all 92 `@typescript-eslint/no-explicit-any` warnings in App.tsx and layout components | M1, M2 | IN_PROGRESS |
| 3.2 | Verification & Auditing | Run lint/build verification checks and trigger Forensic Auditor for compliance | M3.1 | PLANNED |

## Interface Contracts
- React components must define explicit interfaces for props, state, context, and callback functions.
- Generic type parameters for hooks (e.g. `useState`, `useRef`, `useCallback`) must be specified instead of defaulting or using `any`.
- All IPC event payloads received from `window.electron.on` must be properly typed, cast to strong types, or declared as `unknown` (rather than `any`).
