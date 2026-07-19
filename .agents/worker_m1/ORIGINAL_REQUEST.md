## 2026-06-25T01:30:07Z
You are a Milestone 1 Type Safety Worker.
Working Directory: /home/doodcom/Documents/Vortex Agentic V2/.agents/worker_m1

Objective:
Resolve 28 @typescript-eslint/no-explicit-any warnings in `src/types/electron.d.ts` and `src/lib/comfyApi.ts` using the strict typings strategy determined by the exploration phase.

Scope Boundaries:
- Modify ONLY `src/types/electron.d.ts` and `src/lib/comfyApi.ts`. Do not modify other files unless absolutely required for compilation (and if so, keep modifications minimal and type-safe).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Input Information:
- Project root: /home/doodcom/Documents/Vortex Agentic V2
- Initial explorer reports at:
  - /home/doodcom/Documents/Vortex Agentic V2/.agents/teamwork_preview_explorer_m1_1/handoff.md
  - /home/doodcom/Documents/Vortex Agentic V2/.agents/teamwork_preview_explorer_m1_3/handoff.md

Proposed Strategy & Implementation Details:

1. In `src/types/electron.d.ts`:
   A. Insert the following type definitions and interfaces at the top of the file, before `export interface ElectronAPI` (notice that any `any` has been changed to `unknown` to prevent lint warnings):

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
     | { role: 'tool_step'; stepId: string; name: string; args: unknown; result?: unknown; error?: string }
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
     args?: unknown;
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

   B. In `export interface ElectronAPI`, update the following method signatures (replacing all explicit `any` types with the new interfaces):
   - `network: SystemNetworkStats` inside `getSystemStats` return type.
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

2. In `src/lib/comfyApi.ts`:
   A. Insert the following type definitions near the top of the file:

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

   B. Replace all 11 explicit occurrences of `any` with `ComfyWorkflow`. This includes argument typings, return types, and local variable definitions:
   - `workflow: any` in `queuePrompt` parameter -> `workflow: ComfyWorkflow`
   - `workflow: any` in `applyLoras` parameter -> `workflow: ComfyWorkflow`
   - `const workflow: any = {` in `createWorkflow` -> `const workflow: ComfyWorkflow = {`
   - `const baseLoaders: any =` in `createFluxControlNetWorkflow` -> `const baseLoaders: ComfyWorkflow =`
   - `const workflow: any = {` in `createImg2ImgWorkflow` -> `const workflow: ComfyWorkflow = {`
   - `const workflow: any = {` in `createControlNetWorkflow` -> `const workflow: ComfyWorkflow = {`
   - `const workflow: any = {` in `createVideoWorkflow` -> `const workflow: ComfyWorkflow = {`
   - `const workflow: any = {` in `createI2VWorkflow` -> `const workflow: ComfyWorkflow = {`
   - `const workflow: any = {` in `createV2VWorkflow` -> `const workflow: ComfyWorkflow = {`
   - `const workflow: any = {` in `createWanWorkflow` -> `const workflow: ComfyWorkflow = {`
   - `const workflow: any = {` in `createWanI2VWorkflow` -> `const workflow: ComfyWorkflow = {`

Validation & Verification:
- After applying the changes, run `npm run lint` and verify that all `@typescript-eslint/no-explicit-any` errors in `src/types/electron.d.ts` and `src/lib/comfyApi.ts` are resolved (there should be 0 warnings/errors for these files).
- Run `npm run build` and verify that the build succeeds without compilation errors.

Output Requirements:
- Write a detailed report to `/home/doodcom/Documents/Vortex Agentic V2/.agents/worker_m1/handoff.md` summarizing files edited, exact edits made, compile results, and lint validation outputs.
- Report completion back to parent via send_message.
