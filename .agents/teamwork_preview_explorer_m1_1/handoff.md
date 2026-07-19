# Handoff Report — Foundational Electron & ComfyUI API Strict Typings

## 1. Observation

A detailed review of `src/types/electron.d.ts` and `src/lib/comfyApi.ts` reveals a total of **28 occurrences** of the `@typescript-eslint/no-explicit-any` warning. The file-by-file distribution is as follows:

### target 1: `src/types/electron.d.ts` (17 occurrences)
- **Line 22**: `network: any` (in the return type of `getSystemStats()`)
- **Line 27**: `ollamaListModels: () => Promise<any[]>`
- **Line 28**: `ollamaChat: (payload: { model: string, messages: any[] }) => Promise<{ success: boolean, error?: string }>`
- **Line 29**: `ollamaAgenticChat: (payload: { model: string, messages: any[] }) => Promise<{ success: boolean, error?: string }>`
- **Line 30**: `ollamaOrchestrate: (payload: { model: string, messages: any[], customPrompt?: string, searxngUrl?: string }) => Promise<{ success: boolean, error?: string }>`
- **Line 91**: `networkStats: () => Promise<any[]>`
- **Line 92**: `networkConnections: () => Promise<any[]>`
- **Line 95**: `processList: () => Promise<any[]>`
- **Line 99**: `dockerList: () => Promise<any[]>`
- **Line 104**: `systemdListUnits: () => Promise<any[]>`
- **Line 112**: `diskInfo: () => Promise<{ layout: any[]; filesystems: any[] }>` (2 occurrences: `layout: any[]` and `filesystems: any[]`)
- **Line 248**: `openExternal: (url: string) => Promise<any>`
- **Line 249**: `showContextMenu: (props: any) => Promise<any>` (2 occurrences: argument `props: any` and return `Promise<any>`)
- **Line 251**: `on: (channel: string, callback: (...args: any[]) => void) => (() => void)` (1 occurrence in `...args: any[]`)
- **Line 252**: `removeListener: (channel: string, listener?: (...args: any[]) => void) => void` (1 occurrence in `...args: any[]`)

### target 2: `src/lib/comfyApi.ts` (11 occurrences)
- **Line 48**: `export async function queuePrompt(workflow: any, clientId: string)`
- **Line 107**: `function applyLoras(workflow: any, loras: LoraEntry[], ...)`
- **Line 145**: `const workflow: any = { ... }` (inside `createWorkflow`)
- **Line 347**: `const baseLoaders: any = ...` (inside `createFluxControlNetWorkflow`)
- **Line 447**: `const workflow: any = { ... }` (inside `createImg2ImgWorkflow`)
- **Line 489**: `const workflow: any = { ... }` (inside `createControlNetWorkflow`)
- **Line 571**: `const workflow: any = { ... }` (inside `createVideoWorkflow`)
- **Line 637**: `const workflow: any = { ... }` (inside `createI2VWorkflow`)
- **Line 704**: `const workflow: any = { ... }` (inside `createV2VWorkflow`)
- **Line 779**: `const workflow: any = { ... }` (inside `createWanWorkflow`)
- **Line 877**: `const workflow: any = { ... }` (inside `createWanI2VWorkflow`)

---

## 2. Logic Chain

The proposed strict types were derived directly from their source handlers in the Electron main/helper files and their usage pattern in frontend components:

1. **System Stats Network Info (`network: any` -> `SystemNetworkStats`)**
   - *Observation*: `electron/main.ts` (line 186-190) returns:
     ```typescript
     network: {
       rx_sec: networkStats[0]?.rx_sec || 0,
       tx_sec: networkStats[0]?.tx_sec || 0,
       iface: networkStats[0]?.iface || 'detecting'
     }
     ```
   - *Conclusion*: Replace `any` with `SystemNetworkStats` type comprising `rx_sec: number; tx_sec: number; iface: string`.

2. **Ollama Models (`any[]` -> `OllamaModel[]`)**
   - *Observation*: `electron/ollama.ts` fetches from `/api/tags` and returns `response.data.models`. The frontend hook `useOllama.ts` and view `OllamaModelsView.tsx` read `m.name`, `m.size`, `m.modified_at`, and `m.details.family`/`parameter_size`/`quantization_level`.
   - *Conclusion*: Introduce `OllamaModel` interface and `OllamaModelDetails` matching the exact schema returned by Ollama's API.

3. **Ollama Messages (`messages: any[]` -> `messages: OllamaMessage[]`)**
   - *Observation*: Frontend maps messages with custom roles like `'user'`, `'assistant'`, `'system'`, `'tool_step'`, and `'orch_agent'`. Each of these has distinct shape parameters (e.g. `'tool_step'` has `stepId` and `args`, `'orch_agent'` has `agentId` and `status`).
   - *Conclusion*: Define a strongly-typed discriminated union `OllamaMessage` to type check all message structures safely.

4. **Network Stats, Connections, and Processes**
   - *Observation*: In `electron/system-hardware.ts`, `network-stats` maps properties `iface`, `rx_sec`, `tx_sec`, `rx_bytes`, `tx_bytes`, `operstate`, `ip4`, `mac`, `type`. `network-connections` maps `protocol`, `localaddr`, `localport`, `peeraddr`, `peerport`, `state`, `pid`, `process`. `process-list` maps `pid`, `name`, `cpu`, `mem`, `memRss`, `command`, `user`, `state`, `started`.
   - *Conclusion*: Replace general arrays with concrete `NetworkStatItem[]`, `NetworkConnectionItem[]`, and `ProcessListItem[]`.

5. **Docker Containers**
   - *Observation*: In `electron/system-docker.ts` (line 95), `docker-list` maps `id`, `name`, `image`, `state`, `status`, `cpu_percent`, `mem_usage`, `mem_limit`, `net_io`. On error, it catches and returns `{ error: e.message }`.
   - *Conclusion*: Type it as `Promise<DockerContainer[] | { error: string }>`.

6. **Systemd Units**
   - *Observation*: In `electron/system-hardware.ts` (line 75), `systemd-list-units` maps `unit`, `load`, `active`, `sub`, `description`.
   - *Conclusion*: Type it as `Promise<SystemdUnit[]>`.

7. **Disk Info**
   - *Observation*: In `electron/system-hardware.ts` (line 109), `disk-info` returns `{ layout, filesystems }` where `layout` maps `device`, `name`, `type`, `size`, `vendor`, `model`, `serial`, `firmwareRevision`, `smartStatus`, and `filesystems` maps `fs`, `type`, `size`, `used`, `use`, `mount`.
   - *Conclusion*: Replace `any[]` with strict arrays `DiskLayoutItem[]` and `DiskFilesystemItem[]`.

8. **Event listeners (`on` and `removeListener`)**
   - *Observation*: Events are registered on loose strings and callback signatures. However, the system listens to a finite set of channels like `update-log`, `ollama-stream`, `pty-data`, `vortex-notify`, etc., each passing specific arguments.
   - *Conclusion*: Build a map of event channels `ElectronEventMap` and leverage generic parameters (`<K extends keyof ElectronEventMap>`) to provide compile-time safety for event emissions and handling.

9. **ComfyUI Workflows (`workflow: any` -> `workflow: ComfyWorkflow`)**
   - *Observation*: In `src/lib/comfyApi.ts`, workflows are records of nodes where each node has a class type and inputs. Inputs can be strings, numbers, booleans, arrays, or tuples representing connection links (`[nodeId, outputIndex]`).
   - *Conclusion*: Define `ComfyWorkflow`, `ComfyNode`, and `ComfyInputValue` to support complete type checking on ComfyUI config generation.

---

## 3. Caveats

- **Docker Response Union**: Typing `dockerList` as `Promise<DockerContainer[] | { error: string }>` means downstream component code (`src/components/DockerView.tsx`) must be updated to narrow the union properly (using `'error' in res` or `Array.isArray(res)`) before accessing elements, or cast using `as`. Alternatively, the return type could be typed as a hybrid array with optional error `(DockerContainer[] & { error?: string })`, which avoids forced narrowing but is slightly less standard. We recommend the strict union.
- **PTY Arguments**: In the generic listener map `ElectronEventMap`, we used standard types mapped from their frontend usage. Any newly added channel in future updates must be registered in `ElectronEventMap` to avoid compilation errors.

---

## 4. Conclusion

Replacing the loose `any` declarations with these strict structures yields a clean, self-documenting foundational contract.

### Complete Concrete Fix Strategy

#### Proposed Types in `src/types/electron.d.ts`

```typescript
export interface SystemNetworkStats {
  rx_sec: number;
  tx_sec: number;
  iface: string;
}

export interface OllamaModelDetails {
  parent_model?: string;
  format?: string;
  family?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: OllamaModelDetails;
}

export type OllamaMessage =
  | { role: 'user' | 'assistant' | 'system'; content: string; images?: string[] }
  | { role: 'tool_step'; stepId: string; name: string; args: any; result?: any; error?: string }
  | { role: 'orch_agent'; agentId: number; agentRole: string; status: 'working' | 'done'; output?: string };

export interface NetworkStatItem {
  iface: string;
  rx_sec: number;
  tx_sec: number;
  rx_bytes: number;
  tx_bytes: number;
  operstate: string;
  ip4: string;
  mac: string;
  type: string;
}

export interface NetworkConnectionItem {
  protocol: string;
  localaddr: string;
  localport: string;
  peeraddr: string;
  peerport: string;
  state: string;
  pid: number;
  process: string;
}

export interface ProcessListItem {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  memRss: number;
  command: string;
  user: string;
  state: string;
  started: string;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  cpu_percent: number;
  mem_usage: number;
  mem_limit: number;
  net_io: {
    rx: number;
    tx: number;
  };
}

export interface SystemdUnit {
  unit: string;
  load: string;
  active: string;
  sub: string;
  description: string;
}

export interface DiskLayoutItem {
  device: string;
  name: string;
  type: string;
  size: number;
  vendor: string;
  model: string;
  serial: string;
  firmwareRevision: string;
  smartStatus: string;
}

export interface DiskFilesystemItem {
  fs: string;
  type: string;
  size: number;
  used: number;
  use: number;
  mount: string;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  editFlags?: {
    canCut?: boolean;
    canCopy?: boolean;
    canPaste?: boolean;
  };
}

export interface PullProgress {
  status: string;
  completed?: number;
  total?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface OrchAgentEvent {
  agentId: number;
  role: string;
  status: 'working' | 'done';
  output?: string;
}

export interface AgentStepEvent {
  type: 'call' | 'result';
  name: string;
  args?: any;
  result?: string;
  stepId: number;
}

export interface NotificationEntry {
  id?: number | string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp?: string | number;
}

export interface ElectronEventMap {
  'vortex-notify': (entry: NotificationEntry) => void;
  'pty-data': (data: { tabId: string; text: string }) => void;
  'pty-done': (data: { tabId: string; exitCode: number }) => void;
  'update-log': (text: string) => void;
  'ollama-stream': (chunk: string) => void;
  'ollama-pull-progress': (progress: PullProgress) => void;
  'ollama-token': (token: string) => void;
  'ollama-done': () => void;
  'ollama-error': (err: string) => void;
  'ollama-token-usage': (usage: TokenUsage) => void;
  'ollama-orch-agent': (data: OrchAgentEvent) => void;
  'ollama-agent-step': (data: AgentStepEvent) => void;
}
```

Then, update the signature of `ElectronAPI` methods in `src/types/electron.d.ts`:

- `getSystemStats: () => Promise<{ ... network: SystemNetworkStats }>`
- `ollamaListModels: () => Promise<OllamaModel[]>`
- `ollamaChat: (payload: { model: string, messages: OllamaMessage[] }) => Promise<{ success: boolean, error?: string }>`
- `ollamaAgenticChat: (payload: { model: string, messages: OllamaMessage[] }) => Promise<{ success: boolean, error?: string }>`
- `ollamaOrchestrate: (payload: { model: string, messages: OllamaMessage[], customPrompt?: string, searxngUrl?: string }) => Promise<{ success: boolean, error?: string }>`
- `networkStats: () => Promise<NetworkStatItem[]>`
- `networkConnections: () => Promise<NetworkConnectionItem[]>`
- `processList: () => Promise<ProcessListItem[]>`
- `dockerList: () => Promise<DockerContainer[] | { error: string }>`
- `systemdListUnits: () => Promise<SystemdUnit[]>`
- `diskInfo: () => Promise<{ layout: DiskLayoutItem[]; filesystems: DiskFilesystemItem[] }>`
- `openExternal: (url: string) => Promise<{ success: boolean }>`
- `showContextMenu: (props: ContextMenuProps) => Promise<void>`
- `on: <K extends keyof ElectronEventMap>(channel: K, callback: ElectronEventMap[K]) => () => void`
- `removeListener: <K extends keyof ElectronEventMap>(channel: K, listener?: ElectronEventMap[K]) => void`

#### Proposed Types in `src/lib/comfyApi.ts`

```typescript
export type ComfyInputValue =
  | string
  | number
  | boolean
  | [string, number]
  | string[]
  | number[]
  | Record<string, unknown>
  | null
  | undefined;

export interface ComfyNode {
  class_type?: string;
  inputs: Record<string, ComfyInputValue>;
}

export type ComfyWorkflow = Record<string, ComfyNode>;
```

Then, update all workflow generators and API parameters from `any` to `ComfyWorkflow` (such as `workflow` in `queuePrompt` and `applyLoras`, and internal declarations `const workflow: ComfyWorkflow = ...`).

### Downstream Impact Analysis

1. **Elimination of `(window as any).electron`**: Because `electron.d.ts` will compile cleanly and properly expose types on the global `Window` object, downstream React components and custom hooks can import/reference `window.electron` directly instead of casting it to `(window as any).electron`. This will immediately eliminate dozens of inline `any` bypasses in later milestones (e.g. in `useOllama.ts`, `OllamaModelsView.tsx`, `DockerView.tsx`).
2. **Hook Inference**: In `src/hooks/useOllama.ts`, return types of Electron APIs will be strongly typed. Functions like `fetchModels()` mapping the results of `ollamaListModels` will automatically infer item parameters (like `m.name` and `m.size`), allowing developers to remove the manual `(m: any)` type cast from lambdas (`.find((m: any) => ...)`), reducing the `any` count inside `useOllama.ts` by several entries.
3. **Component Validation**: React components rendering stats (`DockerView`, `ProcessView`, `OllamaModelsView`, etc.) will have full compile-time autocomplete and safety, protecting layout rendering logic against property renames in the backend.

---

## 5. Verification Method

To verify these proposed changes when they are implemented in Milestone 1:

1. **Lint Check**: Run ESLint targeting these files:
   ```bash
   npm run lint -- --config eslint.config.js
   ```
   Verify that `@typescript-eslint/no-explicit-any` errors in `src/types/electron.d.ts` and `src/lib/comfyApi.ts` drop from 28 to exactly 0.
2. **Build Check**: Verify that compilation completes successfully without type errors:
   ```bash
   npm run build
   ```
   (Downstream file updates for narrowing, such as handling the `dockerList` error union or removing `(window as any)` wrapper casts, will be validated during their respective hook/component milestones).
