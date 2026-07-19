# Handoff Report — Explicit `any` Analysis

## 1. Observation

- **Command executed**: `npm run lint > .agents/teamwork_preview_explorer_init/lint_output.txt 2>&1`
  - **Result**: Failed with exit code 1 due to lint errors.
  - **Output size**: 349,566 bytes.
- **Command executed**: `npm run build > .agents/teamwork_preview_explorer_init/build_output.txt 2>&1`
  - **Result**: Succeeded with exit code 0.
- **ESLint Configuration**: Checked `eslint.config.js`, which shows that the `@typescript-eslint/no-explicit-any` rule is explicitly disabled for the `electron` directory:
  ```javascript
  {
    files: ['electron/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      ...
    }
  }
  ```
- **Total `@typescript-eslint/no-explicit-any` occurrences**: **338** instances across the codebase.
- **Group counts**:
  - `src/components/`: 238 occurrences (across 43 files)
  - `src/hooks/`: 58 occurrences (across 2 files)
  - `src/types/`: 17 occurrences (across 1 file)
  - `src/App.tsx/` (root): 14 occurrences (across 1 file)
  - `src/lib/`: 11 occurrences (across 1 file)

- **Verbatim Error Snippets**:
  - In `src/App.tsx`:
    ```
    53:32   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
    ```
  - In `src/components/AppLauncherView.tsx`:
    ```
    32:34  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
    ```
  - In `src/hooks/useComfySocket.ts`:
    ```
    12:38  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
    ```
  - In `src/types/electron.d.ts`:
    ```
    22:14  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
    ```
  - In `src/lib/comfyApi.ts`:
    ```
    48:45  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
    ```

---

## 2. Logic Chain

1. **Rule Selection**: Reviewed `eslint.config.js` and confirmed that `@typescript-eslint/no-explicit-any` is configured via `tseslint.configs.recommended` for all `**/*.{ts,tsx}` files except for the `electron` folder where it is explicitly disabled.
2. **Data Generation**: Ran the full linter via `npm run lint` and piped stdout/stderr to `lint_output.txt`. The output contained multiple rule violations (e.g., `react-hooks/set-state-in-effect`, `no-control-regex`, `no-empty`, `@typescript-eslint/no-unused-vars`, and `@typescript-eslint/no-explicit-any`).
3. **Filtering & Parsing**: Programmatically extracted lines matching `@typescript-eslint/no-explicit-any` using a Python script, identifying the parent file path context by tracking the output headers.
4. **Aggregation**: Map/reduced the extracted errors by parent directory path to establish module counts, totaling 338 explicit `any` types.
5. **Build Verification**: Ran `npm run build` to verify that lint warnings do not block the Rolldown/Vite compilation pipeline. The build succeeded without compilation issues.

---

## 3. Caveats

- **Electron Directory**: No warnings were reported inside `electron/**/*.ts` because the rule is configured as `'off'` for those files in `eslint.config.js`. Any explicit `any` definitions in Electron are not accounted for in this report.
- **Ignored Files**: Excluded folders like `dist/` or `release/` (which are ignored by ESLint) were not analyzed.
- **Parsing Assumptions**: The parsing script assumes ESLint's standard output formatting. If formatting changes significantly, parsing might fail to recognize file boundaries.

---

## 4. Conclusion

- The linter reports **338 occurrences** of `@typescript-eslint/no-explicit-any`.
- The directory `src/components/` represents the largest density of these types (70.4% of total warnings).
- The custom hook `src/hooks/useOllama.ts` contains the single highest count for a source code file, with 55 instances.
- Resolving these lint issues requires systematically replacing the explicit `any` declarations in the specified files with proper types, interfaces, generics, or using `unknown`.

---

## 5. Verification Method

- **Command**: Run `npm run lint` from the project root `/home/doodcom/Documents/Vortex Agentic V2` and grep for the rule:
  ```bash
  npm run lint | grep "@typescript-eslint/no-explicit-any" | wc -l
  ```
- **Expected count**: **338** lines matching the rule name.
- **Files to inspect**:
  - The raw lint output file: `/home/doodcom/Documents/Vortex Agentic V2/.agents/teamwork_preview_explorer_init/lint_output.txt`
  - The detailed module-by-module report file: `/home/doodcom/Documents/Vortex Agentic V2/.agents/teamwork_preview_explorer_init/report_raw.md`

---

## 6. Appendix: Detailed Report by Module

### Module `src/components/` (238 occurrences across 43 files)
- **`src/components/AppLauncherView.tsx`** (2 occurrences):
  - Line 32:34 (error) - Unexpected any. Specify a different type
  - Line 58:34 (error) - Unexpected any. Specify a different type
- **`src/components/ArtifactView.tsx`** (6 occurrences):
  - Line 63:36 (error) - Unexpected any. Specify a different type
  - Line 71:17 (error) - Unexpected any. Specify a different type
  - Line 88:39 (error) - Unexpected any. Specify a different type
  - Line 90:22 (error) - Unexpected any. Specify a different type
  - Line 91:21 (error) - Unexpected any. Specify a different type
  - Line 98:17 (error) - Unexpected any. Specify a different type
- **`src/components/AssistantView.tsx`** (31 occurrences):
  - Line 111:40 (error) - Unexpected any. Specify a different type
  - Line 118:17 (error) - Unexpected any. Specify a different type
  - Line 153:23 (error) - Unexpected any. Specify a different type
  - Line 153:79 (error) - Unexpected any. Specify a different type
  - Line 200:39 (error) - Unexpected any. Specify a different type
  - Line 216:36 (error) - Unexpected any. Specify a different type
  - Line 234:43 (error) - Unexpected any. Specify a different type
  - Line 236:42 (error) - Unexpected any. Specify a different type
  - Line 242:42 (error) - Unexpected any. Specify a different type
  - Line 247:53 (error) - Unexpected any. Specify a different type
  - Line 283:37 (error) - Unexpected any. Specify a different type
  - Line 290:39 (error) - Unexpected any. Specify a different type
  - Line 304:37 (error) - Unexpected any. Specify a different type
  - Line 740:31 (error) - Unexpected any. Specify a different type
  - Line 952:82 (error) - Unexpected any. Specify a different type
  - Line 975:69 (error) - Unexpected any. Specify a different type
  - Line 983:36 (error) - Unexpected any. Specify a different type
  - Line 1125:55 (error) - Unexpected any. Specify a different type
  - Line 1137:25 (error) - Unexpected any. Specify a different type
  - Line 1140:26 (error) - Unexpected any. Specify a different type
  - Line 1143:26 (error) - Unexpected any. Specify a different type
  - Line 1146:26 (error) - Unexpected any. Specify a different type
  - Line 1149:26 (error) - Unexpected any. Specify a different type
  - Line 1152:26 (error) - Unexpected any. Specify a different type
  - Line 1155:26 (error) - Unexpected any. Specify a different type
  - Line 1158:34 (error) - Unexpected any. Specify a different type
  - Line 1161:29 (error) - Unexpected any. Specify a different type
  - Line 1168:26 (error) - Unexpected any. Specify a different type
  - Line 1171:26 (error) - Unexpected any. Specify a different type
  - Line 1177:30 (error) - Unexpected any. Specify a different type
  - Line 1180:31 (error) - Unexpected any. Specify a different type
- **`src/components/AuditView.tsx`** (3 occurrences):
  - Line 39:21 (error) - Unexpected any. Specify a different type
  - Line 41:35 (error) - Unexpected any. Specify a different type
  - Line 50:22 (error) - Unexpected any. Specify a different type
- **`src/components/AutomationsView.tsx`** (3 occurrences):
  - Line 32:70 (error) - Unexpected any. Specify a different type
  - Line 212:38 (error) - Unexpected any. Specify a different type
  - Line 221:19 (error) - Unexpected any. Specify a different type
- **`src/components/BenchmarkView.tsx`** (1 occurrences):
  - Line 51:36 (error) - Unexpected any. Specify a different type
- **`src/components/BootView.tsx`** (4 occurrences):
  - Line 31:21 (error) - Unexpected any. Specify a different type
  - Line 33:34 (error) - Unexpected any. Specify a different type
  - Line 45:34 (error) - Unexpected any. Specify a different type
  - Line 52:34 (error) - Unexpected any. Specify a different type
- **`src/components/CleanerView.tsx`** (10 occurrences):
  - Line 21:36 (error) - Unexpected any. Specify a different type
  - Line 23:17 (error) - Unexpected any. Specify a different type
  - Line 34:36 (error) - Unexpected any. Specify a different type
  - Line 37:54 (error) - Unexpected any. Specify a different type
  - Line 41:17 (error) - Unexpected any. Specify a different type
  - Line 53:36 (error) - Unexpected any. Specify a different type
  - Line 61:17 (error) - Unexpected any. Specify a different type
  - Line 73:36 (error) - Unexpected any. Specify a different type
  - Line 83:17 (error) - Unexpected any. Specify a different type
  - Line 287:93 (error) - Unexpected any. Specify a different type
- **`src/components/CommandPalette.tsx`** (2 occurrences):
  - Line 146:28 (error) - Unexpected any. Specify a different type
  - Line 148:32 (error) - Unexpected any. Specify a different type
- **`src/components/CronView.tsx`** (2 occurrences):
  - Line 145:34 (error) - Unexpected any. Specify a different type
  - Line 170:34 (error) - Unexpected any. Specify a different type
- **`src/components/DashboardView.tsx`** (8 occurrences):
  - Line 6:39 (error) - Unexpected any. Specify a different type
  - Line 58:46 (error) - Unexpected any. Specify a different type
  - Line 99:27 (error) - Unexpected any. Specify a different type
  - Line 101:37 (error) - Unexpected any. Specify a different type
  - Line 104:39 (error) - Unexpected any. Specify a different type
  - Line 108:38 (error) - Unexpected any. Specify a different type
  - Line 116:27 (error) - Unexpected any. Specify a different type
  - Line 426:85 (error) - Unexpected any. Specify a different type
- **`src/components/DiskView.tsx`** (7 occurrences):
  - Line 21:42 (error) - Unexpected any. Specify a different type
  - Line 22:42 (error) - Unexpected any. Specify a different type
  - Line 27:21 (error) - Unexpected any. Specify a different type
  - Line 29:61 (error) - Unexpected any. Specify a different type
  - Line 31:30 (error) - Unexpected any. Specify a different type
  - Line 36:42 (error) - Unexpected any. Specify a different type
  - Line 38:36 (error) - Unexpected any. Specify a different type
- **`src/components/DockerComposeBuilderView.tsx`** (2 occurrences):
  - Line 98:21 (error) - Unexpected any. Specify a different type
  - Line 108:21 (error) - Unexpected any. Specify a different type
- **`src/components/DockerView.tsx`** (6 occurrences):
  - Line 29:21 (error) - Unexpected any. Specify a different type
  - Line 30:34 (error) - Unexpected any. Specify a different type
  - Line 51:34 (error) - Unexpected any. Specify a different type
  - Line 62:35 (error) - Unexpected any. Specify a different type
  - Line 235:57 (error) - Unexpected any. Specify a different type
  - Line 248:62 (error) - Unexpected any. Specify a different type
- **`src/components/EnvView.tsx`** (1 occurrences):
  - Line 20:36 (error) - Unexpected any. Specify a different type
- **`src/components/FirewallView.tsx`** (5 occurrences):
  - Line 30:34 (error) - Unexpected any. Specify a different type
  - Line 40:34 (error) - Unexpected any. Specify a different type
  - Line 49:34 (error) - Unexpected any. Specify a different type
  - Line 56:34 (error) - Unexpected any. Specify a different type
  - Line 103:42 (error) - Unexpected any. Specify a different type
- **`src/components/GalleryView.tsx`** (4 occurrences):
  - Line 25:21 (error) - Unexpected any. Specify a different type
  - Line 28:37 (error) - Unexpected any. Specify a different type
  - Line 46:36 (error) - Unexpected any. Specify a different type
  - Line 55:17 (error) - Unexpected any. Specify a different type
- **`src/components/Header.tsx`** (1 occurrences):
  - Line 5:33 (error) - Unexpected any. Specify a different type
- **`src/components/HealthReportView.tsx`** (8 occurrences):
  - Line 18:57 (error) - Unexpected any. Specify a different type
  - Line 65:47 (error) - Unexpected any. Specify a different type
  - Line 124:27 (error) - Unexpected any. Specify a different type
  - Line 125:32 (error) - Unexpected any. Specify a different type
  - Line 137:47 (error) - Unexpected any. Specify a different type
  - Line 151:46 (error) - Unexpected any. Specify a different type
  - Line 152:43 (error) - Unexpected any. Specify a different type
  - Line 152:82 (error) - Unexpected any. Specify a different type
- **`src/components/HistoryView.tsx`** (1 occurrences):
  - Line 115:21 (error) - Unexpected any. Specify a different type
- **`src/components/HomeView.tsx`** (6 occurrences):
  - Line 11:44 (error) - Unexpected any. Specify a different type
  - Line 46:22 (error) - Unexpected any. Specify a different type
  - Line 69:40 (error) - Unexpected any. Specify a different type
  - Line 78:28 (error) - Unexpected any. Specify a different type
  - Line 97:20 (error) - Unexpected any. Specify a different type
  - Line 98:18 (error) - Unexpected any. Specify a different type
- **`src/components/ImageView.tsx`** (17 occurrences):
  - Line 318:20 (error) - Unexpected any. Specify a different type
  - Line 319:18 (error) - Unexpected any. Specify a different type
  - Line 405:20 (error) - Unexpected any. Specify a different type
  - Line 406:18 (error) - Unexpected any. Specify a different type
  - Line 407:21 (error) - Unexpected any. Specify a different type
  - Line 433:36 (error) - Unexpected any. Specify a different type
  - Line 439:17 (error) - Unexpected any. Specify a different type
  - Line 464:28 (error) - Unexpected any. Specify a different type
  - Line 490:19 (error) - Unexpected any. Specify a different type
  - Line 498:20 (error) - Unexpected any. Specify a different type
  - Line 499:24 (error) - Unexpected any. Specify a different type
  - Line 543:19 (error) - Unexpected any. Specify a different type
  - Line 558:19 (error) - Unexpected any. Specify a different type
  - Line 1300:38 (error) - Unexpected any. Specify a different type
  - Line 1301:42 (error) - Unexpected any. Specify a different type
  - Line 1311:38 (error) - Unexpected any. Specify a different type
  - Line 1312:54 (error) - Unexpected any. Specify a different type
- **`src/components/LogAnalysisView.tsx`** (8 occurrences):
  - Line 52:37 (error) - Unexpected any. Specify a different type
  - Line 64:36 (error) - Unexpected any. Specify a different type
  - Line 67:36 (error) - Unexpected any. Specify a different type
  - Line 70:17 (error) - Unexpected any. Specify a different type
  - Line 85:36 (error) - Unexpected any. Specify a different type
  - Line 101:17 (error) - Unexpected any. Specify a different type
  - Line 122:36 (error) - Unexpected any. Specify a different type
  - Line 130:17 (error) - Unexpected any. Specify a different type
- **`src/components/LogView.tsx`** (1 occurrences):
  - Line 48:27 (error) - Unexpected any. Specify a different type
- **`src/components/MemoryView.tsx`** (8 occurrences):
  - Line 22:21 (error) - Unexpected any. Specify a different type
  - Line 25:37 (error) - Unexpected any. Specify a different type
  - Line 41:36 (error) - Unexpected any. Specify a different type
  - Line 49:17 (error) - Unexpected any. Specify a different type
  - Line 56:36 (error) - Unexpected any. Specify a different type
  - Line 61:17 (error) - Unexpected any. Specify a different type
  - Line 69:36 (error) - Unexpected any. Specify a different type
  - Line 75:17 (error) - Unexpected any. Specify a different type
- **`src/components/NetworkView.tsx`** (4 occurrences):
  - Line 60:21 (error) - Unexpected any. Specify a different type
  - Line 61:46 (error) - Unexpected any. Specify a different type
  - Line 78:21 (error) - Unexpected any. Specify a different type
  - Line 79:35 (error) - Unexpected any. Specify a different type
- **`src/components/NotificationCentre.tsx`** (7 occurrences):
  - Line 6:33 (error) - Unexpected any. Specify a different type
  - Line 64:33 (error) - Unexpected any. Specify a different type
  - Line 64:44 (error) - Unexpected any. Specify a different type
  - Line 75:20 (error) - Unexpected any. Specify a different type
  - Line 76:19 (error) - Unexpected any. Specify a different type
  - Line 81:22 (error) - Unexpected any. Specify a different type
  - Line 82:21 (error) - Unexpected any. Specify a different type
- **`src/components/OllamaModelsView.tsx`** (5 occurrences):
  - Line 57:21 (error) - Unexpected any. Specify a different type
  - Line 59:35 (error) - Unexpected any. Specify a different type
  - Line 77:30 (error) - Unexpected any. Specify a different type
  - Line 82:37 (error) - Unexpected any. Specify a different type
  - Line 99:37 (error) - Unexpected any. Specify a different type
- **`src/components/OptimizerView.tsx`** (4 occurrences):
  - Line 9:57 (error) - Unexpected any. Specify a different type
  - Line 37:62 (error) - Unexpected any. Specify a different type
  - Line 39:17 (error) - Unexpected any. Specify a different type
  - Line 139:87 (error) - Unexpected any. Specify a different type
- **`src/components/ProcessView.tsx`** (3 occurrences):
  - Line 58:35 (error) - Unexpected any. Specify a different type
  - Line 84:34 (error) - Unexpected any. Specify a different type
  - Line 110:297 (error) - Unexpected any. Specify a different type
- **`src/components/SandboxView.tsx`** (1 occurrences):
  - Line 39:28 (error) - Unexpected any. Specify a different type
- **`src/components/ServiceView.tsx`** (3 occurrences):
  - Line 45:35 (error) - Unexpected any. Specify a different type
  - Line 58:37 (error) - Unexpected any. Specify a different type
  - Line 67:34 (error) - Unexpected any. Specify a different type
- **`src/components/SettingsPage.tsx`** (7 occurrences):
  - Line 30:9 (error) - Unexpected any. Specify a different type
  - Line 31:12 (error) - Unexpected any. Specify a different type
  - Line 178:27 (error) - Unexpected any. Specify a different type
  - Line 185:22 (error) - Unexpected any. Specify a different type
  - Line 187:35 (error) - Unexpected any. Specify a different type
  - Line 193:22 (error) - Unexpected any. Specify a different type
  - Line 199:22 (error) - Unexpected any. Specify a different type
- **`src/components/Sidebar.tsx`** (6 occurrences):
  - Line 143:48 (error) - Unexpected any. Specify a different type
  - Line 145:36 (error) - Unexpected any. Specify a different type
  - Line 154:47 (error) - Unexpected any. Specify a different type
  - Line 155:41 (error) - Unexpected any. Specify a different type
  - Line 161:47 (error) - Unexpected any. Specify a different type
  - Line 162:41 (error) - Unexpected any. Specify a different type
- **`src/components/SnapshotView.tsx`** (2 occurrences):
  - Line 57:21 (error) - Unexpected any. Specify a different type
  - Line 70:21 (error) - Unexpected any. Specify a different type
- **`src/components/SshView.tsx`** (3 occurrences):
  - Line 92:34 (error) - Unexpected any. Specify a different type
  - Line 100:34 (error) - Unexpected any. Specify a different type
  - Line 112:34 (error) - Unexpected any. Specify a different type
- **`src/components/StartupView.tsx`** (5 occurrences):
  - Line 52:27 (error) - Unexpected any. Specify a different type
  - Line 73:27 (error) - Unexpected any. Specify a different type
  - Line 86:27 (error) - Unexpected any. Specify a different type
  - Line 98:27 (error) - Unexpected any. Specify a different type
  - Line 111:27 (error) - Unexpected any. Specify a different type
- **`src/components/StatusBar.tsx`** (9 occurrences):
  - Line 5:10 (error) - Unexpected any. Specify a different type
  - Line 14:60 (error) - Unexpected any. Specify a different type
  - Line 44:37 (error) - Unexpected any. Specify a different type
  - Line 47:35 (error) - Unexpected any. Specify a different type
  - Line 50:34 (error) - Unexpected any. Specify a different type
  - Line 62:27 (error) - Unexpected any. Specify a different type
  - Line 64:35 (error) - Unexpected any. Specify a different type
  - Line 69:50 (error) - Unexpected any. Specify a different type
  - Line 71:32 (error) - Unexpected any. Specify a different type
- **`src/components/TerminalView.tsx`** (7 occurrences):
  - Line 156:27 (error) - Unexpected any. Specify a different type
  - Line 236:27 (error) - Unexpected any. Specify a different type
  - Line 247:27 (error) - Unexpected any. Specify a different type
  - Line 257:27 (error) - Unexpected any. Specify a different type
  - Line 288:27 (error) - Unexpected any. Specify a different type
  - Line 370:41 (error) - Unexpected any. Specify a different type
  - Line 436:55 (error) - Unexpected any. Specify a different type
- **`src/components/ThemeProvider.tsx`** (1 occurrences):
  - Line 119:56 (error) - Unexpected any. Specify a different type
- **`src/components/UpdatesView.tsx`** (10 occurrences):
  - Line 18:39 (error) - Unexpected any. Specify a different type
  - Line 29:20 (error) - Unexpected any. Specify a different type
  - Line 30:18 (error) - Unexpected any. Specify a different type
  - Line 41:22 (error) - Unexpected any. Specify a different type
  - Line 41:48 (error) - Unexpected any. Specify a different type
  - Line 53:39 (error) - Unexpected any. Specify a different type
  - Line 62:17 (error) - Unexpected any. Specify a different type
  - Line 73:38 (error) - Unexpected any. Specify a different type
  - Line 76:17 (error) - Unexpected any. Specify a different type
  - Line 224:76 (error) - Unexpected any. Specify a different type
- **`src/components/VideoView.tsx`** (13 occurrences):
  - Line 35:22 (error) - Unexpected any. Specify a different type
  - Line 37:20 (error) - Unexpected any. Specify a different type
  - Line 107:22 (error) - Unexpected any. Specify a different type
  - Line 108:20 (error) - Unexpected any. Specify a different type
  - Line 109:23 (error) - Unexpected any. Specify a different type
  - Line 122:37 (error) - Unexpected any. Specify a different type
  - Line 125:20 (error) - Unexpected any. Specify a different type
  - Line 126:36 (error) - Unexpected any. Specify a different type
  - Line 128:20 (error) - Unexpected any. Specify a different type
  - Line 129:36 (error) - Unexpected any. Specify a different type
  - Line 156:19 (error) - Unexpected any. Specify a different type
  - Line 309:46 (error) - Unexpected any. Specify a different type
  - Line 498:48 (error) - Unexpected any. Specify a different type
- **`src/components/WindowControls.tsx`** (1 occurrences):
  - Line 5:16 (error) - Unexpected any. Specify a different type

### Module `src/hooks/` (58 occurrences across 2 files)
- **`src/hooks/useComfySocket.ts`** (3 occurrences):
  - Line 12:38 (error) - Unexpected any. Specify a different type
  - Line 53:41 (error) - Unexpected any. Specify a different type
  - Line 54:58 (error) - Unexpected any. Specify a different type
- **`src/hooks/useOllama.ts`** (55 occurrences):
  - Line 13:40 (error) - Unexpected any. Specify a different type
  - Line 42:48 (error) - Unexpected any. Specify a different type
  - Line 98:21 (error) - Unexpected any. Specify a different type
  - Line 99:46 (error) - Unexpected any. Specify a different type
  - Line 105:21 (error) - Unexpected any. Specify a different type
  - Line 106:35 (error) - Unexpected any. Specify a different type
  - Line 112:21 (error) - Unexpected any. Specify a different type
  - Line 113:35 (error) - Unexpected any. Specify a different type
  - Line 120:21 (error) - Unexpected any. Specify a different type
  - Line 121:22 (error) - Unexpected any. Specify a different type
  - Line 126:21 (error) - Unexpected any. Specify a different type
  - Line 127:22 (error) - Unexpected any. Specify a different type
  - Line 133:37 (error) - Unexpected any. Specify a different type
  - Line 141:21 (error) - Unexpected any. Specify a different type
  - Line 146:37 (error) - Unexpected any. Specify a different type
  - Line 150:37 (error) - Unexpected any. Specify a different type
  - Line 161:21 (error) - Unexpected any. Specify a different type
  - Line 162:18 (error) - Unexpected any. Specify a different type
  - Line 177:21 (error) - Unexpected any. Specify a different type
  - Line 179:48 (error) - Unexpected any. Specify a different type
  - Line 185:39 (error) - Unexpected any. Specify a different type
  - Line 194:21 (error) - Unexpected any. Specify a different type
  - Line 207:39 (error) - Unexpected any. Specify a different type
  - Line 220:22 (error) - Unexpected any. Specify a different type
  - Line 221:20 (error) - Unexpected any. Specify a different type
  - Line 243:40 (error) - Unexpected any. Specify a different type
  - Line 245:43 (error) - Unexpected any. Specify a different type
  - Line 252:84 (error) - Unexpected any. Specify a different type
  - Line 261:42 (error) - Unexpected any. Specify a different type
  - Line 267:17 (error) - Unexpected any. Specify a different type
  - Line 268:17 (error) - Unexpected any. Specify a different type
  - Line 269:17 (error) - Unexpected any. Specify a different type
  - Line 270:17 (error) - Unexpected any. Specify a different type
  - Line 271:17 (error) - Unexpected any. Specify a different type
  - Line 272:17 (error) - Unexpected any. Specify a different type
  - Line 273:17 (error) - Unexpected any. Specify a different type
  - Line 276:19 (error) - Unexpected any. Specify a different type
  - Line 277:19 (error) - Unexpected any. Specify a different type
  - Line 278:19 (error) - Unexpected any. Specify a different type
  - Line 279:19 (error) - Unexpected any. Specify a different type
  - Line 280:19 (error) - Unexpected any. Specify a different type
  - Line 281:19 (error) - Unexpected any. Specify a different type
  - Line 282:19 (error) - Unexpected any. Specify a different type
  - Line 289:36 (error) - Unexpected any. Specify a different type
  - Line 304:17 (error) - Unexpected any. Specify a different type
  - Line 317:46 (error) - Unexpected any. Specify a different type
  - Line 320:41 (error) - Unexpected any. Specify a different type
  - Line 324:56 (error) - Unexpected any. Specify a different type
  - Line 328:53 (error) - Unexpected any. Specify a different type
  - Line 338:38 (error) - Unexpected any. Specify a different type
  - Line 346:20 (error) - Unexpected any. Specify a different type
  - Line 348:22 (error) - Unexpected any. Specify a different type
  - Line 349:22 (error) - Unexpected any. Specify a different type
  - Line 360:20 (error) - Unexpected any. Specify a different type
  - Line 360:52 (error) - Unexpected any. Specify a different type

### Module `src/types/` (17 occurrences across 1 file)
- **`src/types/electron.d.ts`** (17 occurrences):
  - Line 22:14 (error) - Unexpected any. Specify a different type
  - Line 27:35 (error) - Unexpected any. Specify a different type
  - Line 28:52 (error) - Unexpected any. Specify a different type
  - Line 29:59 (error) - Unexpected any. Specify a different type
  - Line 30:59 (error) - Unexpected any. Specify a different type
  - Line 91:31 (error) - Unexpected any. Specify a different type
  - Line 92:37 (error) - Unexpected any. Specify a different type
  - Line 95:30 (error) - Unexpected any. Specify a different type
  - Line 99:29 (error) - Unexpected any. Specify a different type
  - Line 104:35 (error) - Unexpected any. Specify a different type
  - Line 112:37 (error) - Unexpected any. Specify a different type
  - Line 112:57 (error) - Unexpected any. Specify a different type
  - Line 248:42 (error) - Unexpected any. Specify a different type
  - Line 249:28 (error) - Unexpected any. Specify a different type
  - Line 249:44 (error) - Unexpected any. Specify a different type
  - Line 251:45 (error) - Unexpected any. Specify a different type
  - Line 252:58 (error) - Unexpected any. Specify a different type

### Module `src/App.tsx/` (14 occurrences across 1 file)
- **`src/App.tsx`** (14 occurrences):
  - Line 53:32 (error) - Unexpected any. Specify a different type
  - Line 102:38 (error) - Unexpected any. Specify a different type
  - Line 190:22 (error) - Unexpected any. Specify a different type
  - Line 201:21 (error) - Unexpected any. Specify a different type
  - Line 210:29 (error) - Unexpected any. Specify a different type
  - Line 232:23 (error) - Unexpected any. Specify a different type
  - Line 234:36 (error) - Unexpected any. Specify a different type
  - Line 237:38 (error) - Unexpected any. Specify a different type
  - Line 251:36 (error) - Unexpected any. Specify a different type
  - Line 266:27 (error) - Unexpected any. Specify a different type
  - Line 307:25 (error) - Unexpected any. Specify a different type
  - Line 390:36 (error) - Unexpected any. Specify a different type
  - Line 396:23 (error) - Unexpected any. Specify a different type
  - Line 398:36 (error) - Unexpected any. Specify a different type

### Module `src/lib/` (11 occurrences across 1 file)
- **`src/lib/comfyApi.ts`** (11 occurrences):
  - Line 48:45 (error) - Unexpected any. Specify a different type
  - Line 107:13 (error) - Unexpected any. Specify a different type
  - Line 145:19 (error) - Unexpected any. Specify a different type
  - Line 347:22 (error) - Unexpected any. Specify a different type
  - Line 447:19 (error) - Unexpected any. Specify a different type
  - Line 489:19 (error) - Unexpected any. Specify a different type
  - Line 571:19 (error) - Unexpected any. Specify a different type
  - Line 637:19 (error) - Unexpected any. Specify a different type
  - Line 704:19 (error) - Unexpected any. Specify a different type
  - Line 779:19 (error) - Unexpected any. Specify a different type
  - Line 877:19 (error) - Unexpected any. Specify a different type
