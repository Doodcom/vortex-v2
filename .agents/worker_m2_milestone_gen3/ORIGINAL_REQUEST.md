## 2026-06-25T16:30:10Z
You are teamwork_preview_worker. Your task is to apply critical fixes in:
- src/hooks/useOllama.ts: Resolve the event listener leak in the cleanups. Use the unsubscribe functions returned by window.electron.on(...) rather than window.electron.removeListener(...) manually.
- src/hooks/useComfySocket.ts: Coerce the exception_message raw value to string using String(...) before calling raw.includes(...) to prevent a TypeError crash when ComfyUI returns a non-string object.

Make sure you do not introduce any new warnings or errors. Ensure eslint and build compile correctly.
Write your report to /home/doodcom/Documents/Vortex Agentic V2/.agents/worker_m2_milestone_gen3/handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
