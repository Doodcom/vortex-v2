# Handoff Report — 2026-06-25T07:45:00+01:00

This report documents the empirical verification of the type-safety changes in `src/hooks/useComfySocket.ts` and `src/hooks/useOllama.ts`.

## 1. Observation

### Hook Changes under Verification
1. **`src/hooks/useComfySocket.ts`**:
   - Replaced `clientIdRef` with `[clientId] = useState(() => Math.random().toString(36).substring(7))` to hold a stable value.
   - Refactored `reconnectTimeoutRef` to use `ReturnType<typeof setTimeout> | null` type instead of `any`.
   - Added explicit checking of `active.value !== undefined` and typed `nodes` record as `Record<string, ComfyNodeState>` rather than `Record<string, any>`.
   - Replaced implicit/explicit `any` assertions.

2. **`src/hooks/useOllama.ts`**:
   - Replaced `any[]` and other custom structures with concrete typescript interfaces (`OllamaUiModel`, `ToolStepMessage`, `OrchAgentMessage`, `ChatMessage`, `OllamaUiMessage`).
   - Wrapped `pickModel` in `useCallback` and added it along with `models` to the `sendMessage` callback's dependency array to avoid stale closures.
   - Replaced `(window as any).electron` calls with strict `window.electron` calls.
   - Refactored `useEffect` listener cleanups from:
     ```typescript
     return () => {
       ;(window as any).electron.removeListener('ollama-token')
       // ...
     }
     ```
     to:
     ```typescript
     return () => {
       window.electron.removeListener('ollama-token', handleToken)
       // ...
     }
     ```

### Electron Preload Configuration (`electron/preload.ts`)
Lines 176–184 in `electron/preload.ts` define how listeners are added and removed:
```typescript
  on: (channel: string, callback: (...args: any[]) => void) => {
    const listener = (_: any, ...args: any[]) => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  removeListener: (channel: string, listener?: (...args: any[]) => void) => {
    if (listener) ipcRenderer.removeListener(channel, listener)
    else ipcRenderer.removeAllListeners(channel)
  },
```

### Empirical Test Execution
We wrote and ran `tests/verify-listener-leak.js` simulating the exact preload wrapping mechanics and the hook's subscription cycle:
```bash
node tests/verify-listener-leak.js
```
Output:
```
--- Testing Old Behavior ---
Before cleanup: 1 listener(s)
After old cleanup: 0 listener(s)

--- Testing New Behavior (Type Safety Changes) ---
Before cleanup: 1 listener(s)
After new cleanup: 1 listener(s)

❌ BUG CONFIRMED: The event listener was NOT removed and leaked!
```

---

## 2. Logic Chain

1. In `electron/preload.ts`, `window.electron.on` wraps the user-supplied `callback` (e.g. `handleToken`) in an internal wrapper function: `listener = (_: any, ...args: any[]) => callback(...args)`.
2. It registers this internal wrapper `listener` with Electron's `ipcRenderer.on`. The callback `handleToken` is **never** registered directly on `ipcRenderer`.
3. In `useOllama.ts`'s cleanup function, `window.electron.removeListener('ollama-token', handleToken)` is called.
4. In `electron/preload.ts`, this calls `ipcRenderer.removeListener('ollama-token', handleToken)`.
5. Since `handleToken` does not match the internal wrapper `listener`, `ipcRenderer` finds no match and fails to remove the event listener.
6. The event listener leaks and remains attached to `ipcRenderer` forever.
7. Under the old code, `removeListener('ollama-token')` was called without a second argument, resulting in `ipcRenderer.removeAllListeners('ollama-token')`. While this successfully tore down the listener, it had the side effect of clearing all other components' listeners for that channel (though `useOllama` was the only user of these events).
8. The new code introduces a critical memory leak regression where event listeners multiply on every mount/unmount cycle of the `AssistantView` component.

---

## 3. Caveats

- The listener leak runs inside the Electron Renderer process (browser-side). Because this is a React single-page application (SPA), navigation does not reload the page context. Leaving the tab and returning will linearly leak new event listeners.
- The test was executed in a Node.js simulation that reproduces the exact IPC bridge design in `preload.ts` and the hook lifecycle in `useOllama.ts`. The Electron API implements identical event emitter matching rules, guaranteeing this leak is active in the production environment.

---

## 4. Conclusion

* **`src/hooks/useComfySocket.ts`**: The changes are **CORRECT** and performant. The use of a stable `clientId` in state correctly avoids reconnect loops, and the new check `active.value !== undefined` guards against division errors.
* **`src/hooks/useOllama.ts`**: The changes successfully resolve TypeScript warnings but introduce a **CRITICAL event listener leak regression**. 
* **Recommendation**: Refactor `useOllama.ts` to utilize the unsubscribe cleanup functions returned by `window.electron.on`. For example:
  ```typescript
  useEffect(() => {
    if (!window.electron) return

    const unsubscribers = [
      window.electron.on('ollama-token', handleToken),
      window.electron.on('ollama-done', handleDone),
      window.electron.on('ollama-error', handleError),
      window.electron.on('ollama-pull-progress', handlePullProgress),
      window.electron.on('ollama-agent-step', handleAgentStep),
      window.electron.on('ollama-token-usage', handleTokenUsage),
      window.electron.on('ollama-orch-agent', handleOrchAgent)
    ]

    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }, [fetchModels])
  ```

---

## 5. Verification Method

To verify this regression:
1. Review the test file `/home/doodcom/Documents/Vortex Agentic V2/tests/verify-listener-leak.js`.
2. Run the command:
   ```bash
   node tests/verify-listener-leak.js
   ```
3. Observe the output:
   `❌ BUG CONFIRMED: The event listener was NOT removed and leaked!`

---

## Adversarial Review / Challenge Report

### Challenge Summary
* **Overall risk assessment**: **HIGH**

### Challenges

#### [Critical] Challenge 1: Event Listener Memory Leak Regression
- **Assumption challenged**: The new type-safe cleanup call `window.electron.removeListener(channel, callback)` successfully removes the active IPC listener.
- **Attack scenario**: A user opens the Assistant view, starts a chat, switches to another view (unmounting the assistant view), and returns to the assistant view. 
- **Blast radius**: The old listener wrapper remains registered on `ipcRenderer`. When tokens stream back from Ollama, all leaked listeners fire. This causes duplicate state updates, potential out-of-order text rendering, high CPU usage, and eventual browser process memory exhaustion.
- **Mitigation**: Use the returned unsubscribe functions from `window.electron.on(...)` to remove the exact listener wrapper instance.

#### [Low] Challenge 2: Re-creation of `resetError` Callback in `useComfySocket`
- **Assumption challenged**: Re-creating the `resetError` inline function does not affect downstream performance.
- **Attack scenario**: Parent components consuming `useComfySocket` pass `resetError` to dependency arrays of other hooks.
- **Blast radius**: May cause unnecessary re-runs or components re-rendering.
- **Mitigation**: Wrap `resetError` in a `useCallback`:
  ```typescript
  const resetError = useCallback(() => setGenerationError(null), []);
  ```

### Stress Test Results

* **Simulate navigation remounting** → Event listeners should be 0 on unmount → Actual: Event listeners remain at 1 → **FAIL** (listener leaked)
* **Check eslint type safety on hooks** → No `@typescript-eslint/no-explicit-any` errors → Actual: 0 violations → **PASS**
* **Check project compilation/build** → Bundles successfully → Actual: Build verification PASSED → **PASS**
* **Check dry-run boot verification** → Boots and exits cleanly with `--dry-run` → Actual: Boot check PASSED → **PASS**

### Unchallenged Areas
- Backend SQLite/Ollama native integration logic — out of scope for frontend hook type safety review.
