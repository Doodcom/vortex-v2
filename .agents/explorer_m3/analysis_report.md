# Vortex Milestone 3 Type Safety Analysis Report

## Executive Summary
This report analyzes `@typescript-eslint/no-explicit-any` warnings across the core layout and application view files in Vortex Milestone 3. The root cause for almost all `any` casts is the lack of complete, up-to-date TypeScript declarations for the exposed Electron APIs on the global `window` object, alongside untyped component props and implicitly typed callbacks/variables.

By upgrading `src/types/electron.d.ts` to include the complete set of system statistics (`SystemStats` and `SystemGPUStats`) and adding missing Electron IPC wrapper functions, we can eliminate the need for `(window as any).electron` casts across all modules.

---

## 1. Declarations Upgrade: `src/types/electron.d.ts`

### Target File: `src/types/electron.d.ts`
### Problem
The `ElectronAPI` interface has missing method declarations for APIs exposed in `electron/preload.ts`, such as `voiceSpeak`, `voiceTranscribe`, `comfyPurge`, `systemGetErrorLogs`, and `packageGetTree`. Furthermore, `getSystemStats` return type lacks the `storage` and `gpu` properties that are actually returned by the main process.

### Proposed Additions & Fixes
Add the following interfaces and expand `ElectronAPI` and `Window` declarations:

```typescript
export interface SystemGPUStats {
  model: string;
  utilizationGpu: number;
  utilizationMemory: number;
  memoryTotal: number;
  memoryUsed: number;
  temperatureGpu: number;
  powerDraw: number;
  powerLimit: number;
  fanSpeed: number;
  clockCore: number;
}

export interface SystemStats {
  cpu: {
    manufacturer: string;
    brand: string;
    speed: number;
    cores: number;
    load: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    active: number;
  };
  storage: {
    used: number;
    size: number;
    use: number;
  };
  network: SystemNetworkStats;
  gpu: SystemGPUStats | null;
}

// In ElectronAPI:
export interface ElectronAPI {
  // ... existing methods ...
  getSystemStats: () => Promise<SystemStats>;
  systemGetErrorLogs: (lines?: number) => Promise<string>;
  voiceTranscribe: (payload: { audioBase64: string; mimeType?: string }) => Promise<{ success: boolean; text?: string; error?: string }>;
  voiceSpeak: (payload: { text: string }) => Promise<{ success: boolean; audioBase64?: string; error?: string }>;
  comfyPurge: () => Promise<{ success: boolean; error?: string }>;
  packageGetTree: (name: string) => Promise<{ name: string; version: string; direct: string[]; optional: string[]; required: string[]; depDetails: Record<string, string[]> } | null>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    _dragTimer?: ReturnType<typeof setTimeout>;
  }
}
```

---

## 2. File-by-File Analysis & Proposed Changes

### File: `src/App.tsx`
- **Line 53**: `const VIEW_MAP: Record<string, any>`
  - *Why*: Typed as `any` because views have different props.
  - *Fix*: Define a common union type `ActiveViewProps` and type `VIEW_MAP` using it.
- **Line 102**: `const [stats, setStats] = useState<any>(null)`
  - *Why*: Stats type was incomplete.
  - *Fix*: Change to `useState<SystemStats | null>(null)`.
- **Line 190, 201, 232, 234, 237, 266, 396**: `(window as any).electron`
  - *Why*: Workaround for missing types on `window`.
  - *Fix*: Remove `as any` casting and use `window.electron` directly.
- **Line 210**: `const checkAlerts = (s: any, gpuUsedPct: number)`
  - *Why*: Untyped stats parameter.
  - *Fix*: Change `s: any` to `s: SystemStats | null`.
- **Line 251**: `const handleSetI2vSource = (e: any)`
  - *Why*: Untyped custom event.
  - *Fix*: Type as `e: Event` and cast to `CustomEvent<string>`.
- **Line 307**: `const specialProps: any = {}`
  - *Why*: Untyped props injection dictionary.
  - *Fix*: Change to `const specialProps: Partial<ActiveViewProps> = {}`.
- **Line 390**: `const [tree, setTree] = useState<any>(null)`
  - *Why*: Dependency tree structure untyped.
  - *Fix*: Type as `PackageDepTree | null` matching the tree structure interface.

#### Proposed Replacements in `src/App.tsx`:
```typescript
// Define props interface for views
interface ActiveViewProps {
  onNavigate?: (tab: string) => void;
  onExplore?: (name: string) => void;
  initialPackage?: string | null;
  onAnimate?: (url: string) => void;
  i2vSource?: string | null;
  onAskAI?: (tab: string) => void;
  stats?: SystemStats | null;
}

interface PackageDepTree {
  name: string;
  version: string;
  direct: string[];
  optional: string[];
  required: string[];
  depDetails: Record<string, string[]>;
}

const VIEW_MAP: Record<string, React.ComponentType<ActiveViewProps>> = {
  // ... mapping
}

// Inside App component:
const [stats, setStats] = useState<SystemStats | null>(null)
const [tree, setTree] = useState<PackageDepTree | null>(null)
// ...
const checkAlerts = (s: SystemStats | null, gpuUsedPct: number) => { ... }
// ...
const handleSetI2vSource = (e: Event) => {
  setI2vSource((e as CustomEvent<string>).detail)
}
// ...
const specialProps: Partial<ActiveViewProps> = {}
```

---

### File: `src/components/WindowControls.tsx`
- **Line 5**: `(window as any).electron.windowControl(action)`
  - *Why*: Casting `window` to call electron functions.
  - *Fix*: Remove `as any` cast.

#### Proposed Change:
```typescript
  const control = (action: 'minimize' | 'maximize' | 'close') => {
    window.electron.windowControl(action)
  }
```

---

### File: `src/components/Sidebar.tsx`
- **Lines 143, 145, 154, 155, 161, 162**: `(window as any)._dragTimer`
  - *Why*: Storing a drag timeout handle on global window object.
  - *Fix*: Declare `_dragTimer?: ReturnType<typeof setTimeout>` in `Window` interface, then remove the `as any` casts.

#### Proposed Change:
```typescript
// Replace (window as any)._dragTimer with window._dragTimer directly, e.g.:
const timer = window._dragTimer
window._dragTimer = setTimeout(() => { ... })
clearTimeout(window._dragTimer)
delete window._dragTimer
```

---

### File: `src/components/StatusBar.tsx`
- **No warnings found**, but ensure `stats` prop uses the typing `stats: SystemStats | null` to prevent downstream type safety regressions.

---

### File: `src/components/CleanerView.tsx`
- **Line 21, 34, 53, 73**: `(window as any).electron`
  - *Why*: Bypassing window types.
  - *Fix*: Remove `as any`.
- **Line 23, 41, 61, 83**: `catch (e: any)`
  - *Why*: Explicit any on error bindings.
  - *Fix*: Bind as `e: unknown` or implicit `e`, then cast or instantiate safely.
- **Line 37**: `c: any` inside `res.categories.map`
  - *Why*: The categories array was untyped.
  - *Fix*: Once `systemCleanupAnalyze` is typed on `window.electron`, the compiler will automatically infer `c` to have shape `{ name: string; sizeBytes: number; paths: string[] }`. Remove the type annotation `c: any` entirely.
- **Line 287**: `function CleanupCard({ ... }: any)`
  - *Why*: Prop values typed as explicit `any`.
  - *Fix*: Create a `CleanupCardProps` interface.

#### Proposed Changes:
```typescript
interface CleanupCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
  loading: boolean;
  color: string;
  featured?: boolean;
}

function CleanupCard({ icon: Icon, title, description, onClick, loading, color, featured }: CleanupCardProps) {
  // ...
}

// In CleanerView error catches:
catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  setResult({ success: false, error: err.message })
}
```

---

### File: `src/components/DashboardView.tsx`
- **Line 6**: `stats: any` in `DashboardViewProps`
  - *Why*: Untyped stats object.
  - *Fix*: Change to `stats: SystemStats | null`.
- **Line 58**: `const [auditLog, setAuditLog] = useState<any[]>([])`
  - *Why*: Audit log array is untyped.
  - *Fix*: Define `AuditLogEntry` matching `dbGetAuditLog` output.
- **Line 99, 116**: `(window as any).electron`
  - *Why*: Bypassing window types.
  - *Fix*: Use `window.electron` directly.
- **Line 101, 104, 108**: `(rows: any[])`, `(res: any)` callbacks in promise resolution.
  - *Why*: Explicitly casting promise resolutions.
  - *Fix*: Omit parameter types and let type inference handle them.
- **Line 426**: `function StatCard({ ... }: any)`
  - *Why*: Props explicitly typed as `any`.
  - *Fix*: Propose `StatCardProps` interface.

#### Proposed Changes:
```typescript
interface DashboardViewProps {
  stats: SystemStats | null;
  onNavigate?: (tab: string) => void;
}

interface AuditLogEntry {
  id: number;
  command: string;
  exit_code: number | null;
  source: string;
  session_id: number | null;
  created_at: number;
}

interface StatCardProps {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  value: string | number;
  sub: string;
  pct: number;
  color?: string;
}

// In DashboardView:
const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
// ...
useEffect(() => {
  const el = window.electron
  if (!el?.dbGetAuditLog) return
  el.dbGetAuditLog(8).then((rows) => setAuditLog(rows))
  
  if (el?.powerGetProfile) {
    el.powerGetProfile().then((res) => setPowerProfile(res.profile))
  }

  if (el?.guardianStatus) {
    el.guardianStatus().then((res) => {
      setGuardianEnabled(res.enabled)
      setGuardianActiveOpt(res.activeOptimization)
    })
  }
}, [])

function StatCard({ icon: Icon, label, value, sub, pct, color = 'var(--crimson)' }: StatCardProps) {
  // ...
}
```

---

### File: `src/components/HomeView.tsx`
- **Line 11**: `const [entities, setEntities] = useState<any[]>([])`
  - *Why*: Home assistant states array untyped.
  - *Fix*: Propose `HAEntityState` interface.
- **Line 46**: `const headers: any = { ... }`
  - *Why*: Network fetch headers cast to `any`.
  - *Fix*: Type as `Record<string, string>`.
- **Line 69, 78**: `(e: any)` filter/forEach parameter typing.
  - *Why*: State array items untyped.
  - *Fix*: Once state uses `HAEntityState[]`, typing is inferred. Remove `: any`.
- **Line 97**: `(window as any).electron`
  - *Why*: Casting `window` to access electron APIs.
  - *Fix*: Change to `window.electron` directly.

#### Proposed Changes:
```typescript
interface HAEntityState {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    [key: string]: unknown;
  };
  last_changed: string;
  last_updated: string;
}

// In HomeView:
const [entities, setEntities] = useState<HAEntityState[]>([])
// ...
const headers: Record<string, string> = { 'Content-Type': 'application/json' }
// ...
const filtered = data.filter((e: HAEntityState) => ... )
```

---

### File: `src/components/SettingsPage.tsx`
- **Line 30-31**: `icon: any`, `offIcon: any`
  - *Why*: Icons untyped.
  - *Fix*: Type as `React.ComponentType<{ size?: number; style?: React.CSSProperties }>`.
- **Line 174**: `const [memories, setMemories] = useState<{ id: number; fact: string; created_at: number }[]>([])`
  - *Status*: Correctly typed.
- **Line 178, 185, 187, 193, 199**: `(window as any).electron`
  - *Why*: Bypassing type checking.
  - *Fix*: Use `window.electron` directly.
- **Line 180, 187**: `setMemories`, `.then((rows: any[]) => ...)`
  - *Why*: Explicit casting of memory arrays.
  - *Fix*: Remove callback types or use `{ id: number; fact: string; created_at: number }[]` and let inference handle it.

#### Proposed Changes:
```typescript
interface ToggleProps {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  offIcon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
}

function Toggle({ enabled, onChange, label, sublabel, icon: Icon, offIcon: OffIcon }: ToggleProps) {
  // ...
}

// In SettingsPage:
useEffect(() => {
  const el = window.electron
  if (!el?.memoryGetAll) return
  el.memoryGetAll().then(setMemories)
}, [])
```

---

### File: `src/components/AssistantView.tsx`
- **Line 118**: `catch (e: any)`
  - *Why*: Catch error parameter explicitly typed.
  - *Fix*: Use `e: unknown` and narrow down with type guard.
- **Line 153**: `.then((res: any) => {`
  - *Why*: Speak result untyped.
  - *Fix*: Handled via signature updates in `electron.d.ts`. Remove `: any`.
- **Line 236**: `(m: any)` in memories mapper.
  - *Why*: Untyped array items.
  - *Fix*: Remove mapping or type implicitly via typed `memoryGetAll()`.
- **Line 283, 290, 304**: `(window as any).electron`
  - *Why*: Bypassing global window properties.
  - *Fix*: Use `window.electron` directly.
- **Line 740**: `messages.map((msg: any, i: number)`
  - *Why*: UI Message structure treated as `any`.
  - *Fix*: Import `OllamaUiMessage` from `useOllama` hook and type `msg: OllamaUiMessage`.
- **Line 952**: `QuickModelBtn({ ... }: any)`
  - *Why*: Untyped prop dictionary.
  - *Fix*: Define `QuickModelBtnProps` interface.
- **Line 975**: `args: any` in `ToolStepCard`
  - *Why*: Custom tool arguments untyped.
  - *Fix*: Type as `unknown` or `Record<string, unknown>`.
- **Line 983**: `TOOL_ICONS: Record<string, any>`
  - *Why*: Map of component types untyped.
  - *Fix*: Type as `Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>`.
- **Line 1125 - 1180**: `code({ ... }: any)`, `p({ ... }: any)`, etc.
  - *Why*: Markdown components arguments explicitly typed as `any`.
  - *Fix*: Define distinct props typings for each component (e.g. `{ children?: React.ReactNode }`, `{ href?: string; children?: React.ReactNode }`).

#### Proposed Changes:
```typescript
import { useOllama, type Session, type OllamaUiMessage } from '../hooks/useOllama'

interface QuickModelBtnProps {
  label: string;
  name: string;
  isAvailable: boolean;
  onSelect: (name: string) => void;
  onPull: (name: string) => void;
  isActive: boolean;
}

// Inside AssistantView:
{messages.map((msg: OllamaUiMessage, i: number) => {
  // ... TypeScript type narrowing acts on msg.role automatically
})}

// Markdown components definitions:
code({ className, children, inline }: { className?: string; children?: React.ReactNode; inline?: boolean }) {
  const isBlock = !inline
  const lang = (className ?? '').replace('language-', '')
  if (isBlock) {
    return <ArtifactView code={String(children).replace(/\n$/, '')} language={lang || 'text'} isStreaming={isStreaming} />
  }
  return (
    <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--crimson)', fontFamily: 'monospace', fontSize: '0.875em' }}>
      {children}
    </code>
  )
}
```

---

## 3. Verification Method

To verify these changes:
1. Apply the types additions to `src/types/electron.d.ts`.
2. Apply the modifications to the 9 view files.
3. Run the project compile command to check for any lint/tsc compilation issues:
   ```bash
   npm run build
   # OR
   npx tsc --noEmit
   ```
If all code compiles cleanly, the warnings will be fully resolved, and strong typing will be restored to the codebase.
