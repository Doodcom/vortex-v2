# Scope: Milestone 2 — Core Custom Hooks

## Architecture
- `src/hooks/useComfySocket.ts` manages connection state and incoming messages/events from a ComfyUI websocket server. It exposes socket connection, disconnection, message sending, and status hooks.
- `src/hooks/useOllama.ts` handles communication with the local Ollama LLM service, exposing methods for model lists, starting/stopping models, prompting/chatting, memory context management, and service health checking.
- Both hooks interface with `window.electron` and `src/lib/comfyApi.ts`. Milestone 2 relies on types defined in Milestone 1 (found inside `src/types/electron.d.ts` and `src/lib/comfyApi.ts`).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 2.1 | useComfySocket.ts type safety | Resolve all 3 `@typescript-eslint/no-explicit-any` warnings in useComfySocket.ts | M1 | IN_PROGRESS |
| 2.2 | useOllama.ts type safety | Resolve all 55 `@typescript-eslint/no-explicit-any` warnings in useOllama.ts | M1 | IN_PROGRESS |
| 2.3 | Verification & Auditing | Run lint/build verification checks and trigger Forensic Auditor for compliance | M2.1, M2.2 | PLANNED |

## Interface Contracts
- `useComfySocket.ts`:
  - Socket messages must map to strong event types (e.g., standard ComfyUI socket message payloads).
  - State handlers and callback parameters must have explicit types (e.g. `WebSocket` events, custom data payload types) instead of `any`.
- `useOllama.ts`:
  - Arguments and responses for Ollama calls must map to types exposed in `window.electron` (`OllamaModel`, `OllamaMessage`, etc.).
  - Hooks returning state or dispatching events (e.g. chat history, generation outputs, status events) must use explicit generic interfaces.
