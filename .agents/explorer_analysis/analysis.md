# Analysis and Partition Plan: `electron/system.ts`

This document details the analysis of the monolithic 2350-line `electron/system.ts` file in the Vortex codebase and provides a concrete partition plan to split its 110 IPC handlers and helper utilities into domain-specific modules.

---

## 1. Executive Summary
The `electron/system.ts` module acts as a massive backend orchestrator for Vortex, handling everything from local voice transcription, Piper TTS, HEIC image conversion, Docker container management, and Btrfs scrubbing, to game optimization macros. It consists of **110 distinct IPC handlers** (`ipcMain.handle`) and several helper functions. 

To improve maintainability, reduce compile/lint times, and prevent merge conflicts, we propose partitioning this file into:
1. **`system-common.ts`**: Shared execution utilities, local DB integration, and IPC log streaming.
2. **Nine (9) domain-specific files**:
   - `system-media.ts`
   - `system-maintenance.ts`
   - `system-hardware.ts`
   - `system-docker.ts`
   - `system-packages.ts`
   - `system-btrfs.ts`
   - `system-ai.ts`
   - `system-desktop.ts`
   - `system-security.ts`

To ensure **zero regression**, the existing entry point `electron/system.ts` will serve as a central aggregator, importing and registering all modular handlers and re-exporting shared methods (like `runGameModeToggle`). This ensures that `electron/main.ts` and `electron/VortexGuardian.ts` require absolutely no modification.

---

## 2. Core Dependencies and Helper Functions

The monolithic module relies on a series of external Node.js libraries, packages, local modules, and custom helper routines:

### External & Node Core Imports
- `electron` (`ipcMain`, `dialog`)
- `child_process` (`exec`, `spawn`)
- `util` (`promisify`)
- `fs` (various synchronous file operations)
- `path` (`join`, `extname`, `resolve`)
- `os` (`homedir`, `tmpdir`)
- `axios` (used for Arch news feeds, fetching web images, ComfyUI purges, and log analyses)
- `systeminformation` (used for system resource statistics)
- `./db` (`db` SQLite database instance)

### Global Helpers (in `electron/system.ts`)
1. **`execPromise`**: `promisify(exec)` used to run shell operations synchronously with async/await.
2. **`detectAurHelper()`**: Probes the system for AUR helpers (`paru`, `yay`, `trizen`), defaulting to `pacman`.

### Handler-Specific Helpers (scoped to `setupSystemHandlers`)
1. **`notify(title, message, type)`**: Sends webContents IPC message `notification` to the renderer UI.
2. **`streamLog(text)`**: Sends webContents IPC message `update-log` to stream CLI progress to the UI.
3. **`runStreamingCmd(cmd, args, options)`**: Wraps `spawn` to run commands with live-throttled stdout/stderr streaming back to the renderer (caps logs at 100KB, throttles updates to 5fps).
4. **`parseBtrfsSize(str)`**: Custom parsing utility converting size strings (e.g. "10GiB") into bytes.
5. **`parseServicesFromYaml(yaml)`**: Evaluates Docker Compose YAML to output an array of service names.

---

## 3. Catalog of the 110 IPC Handlers

Here is a breakdown of all handlers currently registered in `electron/system.ts`, mapped by their logical domains:

### Domain A: System Media & Files (`system-media.ts`) - 8 Handlers
Handles media synthesis, transcription, storage, conversion, and local filesystem viewing.

| # | IPC Handler Channel Name | Input Parameter Shape | Output Type / Response Shape | Primary Logic / Commands Executed |
|---|--------------------------|-----------------------|------------------------------|-----------------------------------|
| 1 | `system-save-asset` | `{ url: string, type: 'image'\|'video', filename?: string }` | `{ success: boolean, path?: string, error?: string }` | Downloads buffer using Axios, writes to `~/.tmp`, and moves using `ionice -c 3 -n 7 mv` into user's `Pictures/AI Images` or `Pictures/AI Video`. |
| 2 | `voice-transcribe` | `{ audioBase64: string, mimeType?: string }` | `{ success: boolean, text?: string, error?: string }` | Decodes base64, runs `ffmpeg` to format to 16kHz mono WAV, and processes with `whisper.cpp/build/bin/whisper-cli`. |
| 3 | `voice-speak` | `{ text: string }` | `{ success: boolean, audioBase64?: string, error?: string }` | Runs `piper-tts` using the `en_US-amy-medium.onnx` model, reads output WAV, and returns base64. |
| 4 | `system-convert-heic` | `{ base64: string, ext: string }` | `{ success: boolean, dataUrl?: string, error?: string }` | Converts HEIC/HEIF (AVIF/TIFF etc.) using `heif-convert`, falling back to `magick` for JPEGs. |
| 5 | `system-read-text-file` | `filePath: string` | `{ success: boolean, content?: string, error?: string }` | Reads text file using `fs.readFileSync` (capped at 1MB to protect renderer). |
| 6 | `system-read-local-image` | `filePath: string` | `string` (Data URL) or `{ error: string }` | Reads local image, detects MIME type, and returns base64 Data URL. |
| 7 | `system-list-assets` | None | `Array<{ name, path, type, size, mtime, url }>` | Scans `Pictures/AI Images` and `Pictures/AI Video`, filters by media extensions, and returns stat details sorted by modified time. |
| 8 | `system-delete-asset` | `filePath: string` | `{ success: boolean, error?: string }` | Verifies that path is sub-nested in `~/Pictures`, then calls `fs.unlinkSync`. |

---

### Domain B: Maintenance & Diagnostics (`system-maintenance.ts`) - 12 Handlers
Manages upgrades, cleanups, journal logging, and log remediation using a local LLM.

| # | IPC Handler Channel Name | Input Parameter Shape | Output Type / Response Shape | Primary Logic / Commands Executed |
|---|--------------------------|-----------------------|------------------------------|-----------------------------------|
| 9 | `system-check-updates` | None | `{ repo: string[], aur: string[] }` | Runs `checkupdates` and `yay -Qua` / `paru -Qua` to fetch package lists. |
| 10| `system-upgrade` | None | `{ success: boolean, log: string }` | Snapshots root via Snapper, checks AUR helper, and runs `pacman -Syu --noconfirm` or helper upgrade. |
| 11| `system-cleanup` | `type: 'cache'\|'orphans'\|'logs'\|'all'` | `{ success: boolean, output?: string, error?: string }` | Runs `paccache -r -k 1`, `journalctl --vacuum-time=3d`, and/or orphan package pruning via pkexec. |
| 12| `system-cleanup-analyze` | None | `{ success: boolean, categories?: Array<{name, sizeBytes, paths}>, error?: string }` | Calculates disc usage of system logs via `journalctl --disk-usage`, Pacman Cache (`du -sb`), and top 10 folders in `~/.cache`. |
| 13| `system-cleanup-execute` | `categories: string[]` | `{ success: boolean, logs?: string, error?: string }` | Vacuums journals, purges pacman caches, and cleans selected user cache dirs. |
| 14| `log-remediation-analyze`| `{ unit?: string, lines?: number, model?: string }` | `{ success: boolean, problem?, diagnosis?, remediationCommand?, remediationSafety?, error? }` | Fetches journalctl output, posts to local Ollama API `http://127.0.0.1:11434/api/chat` with diagnostics prompt, and parses JSON output. |
| 15| `log-remediation-apply`  | `{ command: string }` | `{ success: boolean, output?: string, error?: string }` | Checks input command against dangerous patterns (e.g. `rm -rf /`, `mkfs`), then executes it via `pkexec bash -c`. |
| 16| `system-optimize` | `type: 'ssd'\|'services'\|'performance'` | `{ success: boolean, output?: string, error?: string }` | Runs `fstrim -av`, `systemctl reset-failed`, or CPU governor performance profile change. |
| 17| `system-get-logs` | `lines?: number` | `string` | Runs `journalctl -n <lines> --no-pager` (clamped between 10 and 10000). |
| 18| `system-get-error-logs` | `lines?: number` | `string` | Runs `journalctl -p 3 -n <lines> --no-pager`. |
| 19| `journal-get-logs` | `{ unit?, priority?, lines?, keyword?, since? }` | `{ success: boolean, lines: string[] }` | Queries journalctl with detailed arguments and filters (`-u`, `-p`, `--since`, `-n`, `-g`). |
| 20| `system-analyze-boot` | None | `{ summary: string, units: Array<{ time_ms, unit }> }` | Runs `systemd-analyze` and `systemd-analyze blame` to profile boot sequence times. |

---

### Domain C: Hardware & Information (`system-hardware.ts`) - 18 Handlers
Gathers hardware parameters, monitors network sockets, controls systemd, checks GPU limits, and runs core performance benchmarks.

| # | IPC Handler Channel Name | Input Parameter Shape | Output Type / Response Shape | Primary Logic / Commands Executed |
|---|--------------------------|-----------------------|------------------------------|-----------------------------------|
| 21| `network-stats` | None | `Array<{ iface, rx_sec, tx_sec, rx_bytes, tx_bytes, operstate, ip4, mac, type }>` | Combines `si.networkInterfaces()` and `si.networkStats()` measurements. |
| 22| `network-connections` | None | `Array<{ protocol, localaddr, localport, peeraddr, peerport, state, pid, process }>` | Joins sockets from `si.networkConnections()` with process names from `si.processes()`. |
| 23| `process-list` | None | `Array<{ pid, name, cpu, mem, memRss, command, user, state, started }>` | Fetches list of active system tasks from `si.processes()`. |
| 24| `process-kill` | `{ pid: number, signal?: string }` | `{ success: boolean, error?: string }` | Kills process ID using `kill -<signal> <pid>`. |
| 25| `systemd-list-units` | None | `Array<{ unit, load, active, sub, description }>` | Lists systemd units using `systemctl list-units --type=service`. |
| 26| `systemd-control-unit` | `{ unit: string, action: string }` | `{ success: boolean, output?: string, error?: string }` | Runs systemd actions (`start`, `stop`, `restart`, `enable`, `disable`, `reload`) via pkexec. |
| 27| `systemd-unit-logs` | `{ unit: string, lines?: number }` | `string` | Reads service-specific journal entries: `journalctl -u <unit> -n <lines>`. |
| 28| `disk-info` | None | `{ layout: Array<any>, filesystems: Array<any> }` | Combines disk hardware listings (`si.diskLayout()`) and filesystems statuses (`si.fsSize()`). |
| 29| `disk-smart` | `device: string` | `{ health: string, temp: number\|null }` | Parses SMART attributes via `pkexec smartctl -H -A <dev>`. |
| 30| `power-get-profile` | None | `{ profile: string }` | Reads power profile from `powerprofilesctl get` or Platform Profile ACPI parameters. |
| 31| `power-set-profile` | `profile: string` | `{ success: boolean, error?: string }` | Updates profile configuration via `powerprofilesctl set <profile>`. |
| 32| `chwd-detect` | None | `{ success: boolean, output: string }` | Lists hardware drivers status using `chwd --list`. |
| 33| `chwd-install` | `profile: string` | `{ success: boolean, output: string }` | Installs driver packages: `pkexec chwd --install <profile>`. |
| 34| `fprintd-status` | None | `{ success: boolean, active: boolean, devices: string }` | Checks systemd status of `fprintd.service` and queries pacman for package existence. |
| 35| `gpu-vram-stats` | None | `{ success: boolean, used: number, total: number, free: number, gpuUtil: number }` | Fetches NVIDIA stats: `nvidia-smi --query-gpu=memory.used,memory.total,memory.free,utilization.gpu --format=csv,noheader,nounits`. |
| 36| `system-audit-arch` | None | `{ success: boolean, packages: Array<{name, repo, isGeneric}> }` | Audits installed packages not matching `cachyos-v4` or `cachyos-v3` microarchitectures. |
| 37| `system-rebuild-native` | `pkgName: string` | `{ success: boolean, log: string }` | Rebuilds package from source/AUR to apply native optimization flags. |
| 38| `benchmark-run` | `{ tests: string[] }` | `{ success: boolean, results: Record<string, any>, error?: string }` | Computes hardware capability metrics (CPU cycles, disk write/read throughputs, RAM copying) using standard tools like `dd`. |

---

### Domain D: Docker Containers (`system-docker.ts`) - 7 Handlers
Orchestrates individual containers and multi-service docker compose projects.

| # | IPC Handler Channel Name | Input Parameter Shape | Output Type / Response Shape | Primary Logic / Commands Executed |
|---|--------------------------|-----------------------|------------------------------|-----------------------------------|
| 39| `docker-list` | None | `Array<{ id, name, image, state, status, cpu_percent, mem_usage, mem_limit, net_io }>` | Parses `docker ps -a` outputs, joining resource usages via `docker stats --no-stream`. |
| 40| `docker-control` | `{ id: string, action: string }` | `{ success: boolean, error?: string }` | Starts, stops, restarts, pauses, or unpauses containers. |
| 41| `docker-logs` | `{ id: string, lines?: number }` | `string` | Extracts container log streams: `docker logs --tail <lines> <id>`. |
| 42| `docker-compose-deploy`  | `{ projectName: string, yamlContent: string }` | `{ success: boolean, log?: string, error?: string }` | Creates project directory at `~/Vortex-Compose/<name>`, writes `docker-compose.yml`, and runs `docker compose up -d`. |
| 43| `docker-compose-down` | `{ projectName: string }` | `{ success: boolean, log?: string, error?: string }` | Shuts down project containers: `docker compose down`. |
| 44| `docker-compose-delete` | `{ projectName: string }` | `{ success: boolean, error?: string }` | Stops compose containers and purges directory files. |
| 45| `docker-compose-list` | None | `{ success: boolean, projects: Array<{name, path, status, services}> }` | Scans directories under `~/Vortex-Compose` for docker-compose configurations, parsing service structures and testing process statuses. |

---

### Domain E: Package Managers (`system-packages.ts`) - 15 Handlers
Exposes package queries, updates, and controls for pacman, yay/paru AUR helpers, Flatpak, and local AppImages.

| # | IPC Handler Channel Name | Input Parameter Shape | Output Type / Response Shape | Primary Logic / Commands Executed |
|---|--------------------------|-----------------------|------------------------------|-----------------------------------|
| 46| `package-detect-helper`  | None | `string` (aur helper name) | Queries default AUR helper using `detectAurHelper()`. |
| 47| `package-search` | `query: string` | `Array<{ repo, name, version, description, installed, source }>` | Searches Pacman database: `pacman -Ss <query>`. |
| 48| `package-list-aur` | None | `Array<{ name, version }>` | Queries AUR packages using `yay -Qm` or `paru -Qm`. |
| 49| `package-info` | `name: string` | `Record<string, string> \| null` | Fetches package info metadata: `pacman -Si <name>` or `pacman -Qi <name>`. |
| 50| `package-install` | `{ name: string, helper: string }` | `{ success: boolean, output: string }` | Attempts native CachyOS `shelly` D-Bus install. Falls back to executing pacman or AUR helper commands. |
| 51| `package-remove` | `name: string` | `{ success: boolean, output: string }` | Tries `shelly` D-Bus package removal, falling back to `pkexec pacman -Rns`. |
| 52| `package-dep-tree` | `name: string` | `DependencyNode \| null` | Evaluates dependency hierarchies: `pactree -l <name>`. |
| 53| `flatpak-list` | None | `{ success: boolean, apps: Array<{id, name, version, summary}>, error? }` | Queries flatpaks: `flatpak list --columns=application,name,version,summary --parsable`. |
| 54| `flatpak-search` | `query: string` | `{ success: boolean, results: Array<{id, name, version, description}>, error? }` | Runs `flatpak search`. |
| 55| `flatpak-install` | `appId: string` | `{ success: boolean, error?: string }` | Installs flatpak: `flatpak install -y <appId>` with streaming logging. |
| 56| `flatpak-uninstall` | `appId: string` | `{ success: boolean, error?: string }` | Uninstalls flatpak: `flatpak uninstall -y <appId>`. |
| 57| `appimage-list` | None | `{ success: boolean, apps: Array<{filename, path, registered, executable}> }` | Scans `~/Applications` and `~/Downloads` for AppImages, checking execute permissions and desktop entries. |
| 58| `appimage-register` | `path: string` | `{ success: boolean, error?: string }` | Writes standard Linux desktop entries under `~/.local/share/applications/` to register AppImage shortcuts. |
| 59| `appimage-unregister` | `path: string` | `{ success: boolean, error?: string }` | Removes desktop file to deregister AppImage shortcuts. |
| 60| `appimage-make-executable`| `path: string` | `{ success: boolean, error?: string }` | Adds execute permissions to AppImage: `chmod +x`. |

---

### Domain F: Btrfs & Snapper Backup (`system-btrfs.ts`) - 9 Handlers
Controls advanced Btrfs maintenance utilities and manages Snapper system snapshots.

| # | IPC Handler Channel Name | Input Parameter Shape | Output Type / Response Shape | Primary Logic / Commands Executed |
|---|--------------------------|-----------------------|------------------------------|-----------------------------------|
| 61| `btrfs-scrub` | `action: 'start'\|'status'\|'cancel'` | `{ success: boolean, status: string, progress?, errors?, error? }` | Runs `btrfs scrub start /`, checks statistics status, or cancels scrub. |
| 62| `btrfs-balance` | `action: 'start'\|'status'\|'cancel', dusage?, musage?` | `{ success: boolean, status: string, error?: string }` | Runs `btrfs balance start --background -dusage=<d> -musage=<m> /`, reads balance logs, or halts execution. |
| 63| `btrfs-defrag` | `path: string` | `{ success: boolean, error?: string }` | Deflagments paths recursively: `pkexec btrfs filesystem defragment -r "<path>"`. |
| 64| `btrfs-usage` | None | `{ success: boolean, dataAlloc, metaAlloc, unallocated, error? }` | Evaluates Btrfs details: `btrfs filesystem usage /`. |
| 65| `system-snapper-snapshot`| `desc?: string` | `{ success: boolean, output: string }` | Creates pre-change Snapper checkpoint: `pkexec snapper -c root create -t pre -p -d <desc>`. |
| 66| `system-snapper-list` | None | `{ success: boolean, snapshots: Array<{id, type, date, description, usedSpace}>, error? }` | Parses snapper table: `pkexec snapper --csvout --separator "\|" -c root list`. |
| 67| `system-snapper-create` | `{ description: string }` | `{ success: boolean, id: string }` | Generates custom rollback points: `pkexec snapper -c root create -t single -d <desc>`. |
| 68| `system-snapper-delete` | `{ id: string }` | `{ success: boolean, error?: string }` | Purges snapshots: `pkexec snapper -c root delete <id>`. |
| 69| `system-snapper-rollback`| `{ id: string }` | `{ success: boolean, output: string }` | Runs Snapper system recovery rollback: `pkexec snapper rollback <id>`. |

---

### Domain G: AI Stack Tuning & Gaming (`system-ai.ts`) - 14 Handlers
Fine-tunes Ollama VRAM allocations, updates ComfyUI models, tunes kernel schedulers (SCX, BORE), runs WinBoat Windows sandbox sessions, and controls gaming performance toggles.

| # | IPC Handler Channel Name | Input Parameter Shape | Output Type / Response Shape | Primary Logic / Commands Executed |
|---|--------------------------|-----------------------|------------------------------|-----------------------------------|
| 70| `ai-update-components` | None | `{ success: boolean, log: string }` | Creates system checkpoint, executes git pulls across comfyui cores/custom-nodes, checks Ollama service status, and updates neural weights via `ollama pull`. |
| 71| `comfy-purge` | None | `{ success: boolean, error?: string }` | Unloads VRAM model structures: POST to `http://127.0.0.1:8188/free`. |
| 72| `io-tune-for-ai` | `mode: 'ai'\|'default'` | `{ success: boolean, output: string }` | Sets NVMe Kyber read/write latencies (`read_lat_nsec`, `write_lat_nsec`). |
| 73| `scx-status` | None | `{ success: boolean, scheduler, mode, state, schedulers }` | Reads `org.scx.Loader` DBus interface features and checks active kernel scheduler modules. |
| 74| `scx-set-scheduler` | `{ name: string, mode?: number }` | `{ success: boolean, error?: string }` | Activates kernel scheduler profiles via DBus loader interfaces. |
| 75| `scx-stop` | None | `{ success: boolean, error?: string }` | Halts execution of scx scheduler modules via DBus loader. |
| 76| `scx-metrics` | None | `{ success: boolean, state, enableSeq, nrRejected }` | Reads execution metrics from `/sys/kernel/sched_ext/` kernel files. |
| 77| `bore-set-profile` | `profile: string` | `{ success: boolean, output: string, partial: boolean }` | Configures BORE scheduler burst penalties and smoothness thresholds via `sysctl`. |
| 78| `ollama-set-vram-mode` | `mode: 'max'\|'budget'` | `{ success: boolean, output: string }` | Writes environment override files under `/etc/systemd/system/ollama.service.d/override.conf` and restarts Ollama service. |
| 79| `ollama-pin-vcache` | None | `{ success: boolean, output: string }` | Pins active Ollama processes to AMD 3D V-Cache cores (0-7) and increases thread priority to -5. |
| 80| `gpu-vram-squeeze` | None | `{ success: boolean, output: string }` | Runs `pkexec dmemcg-booster --aggressive` to force-free background VRAM allocations. |
| 81| `game-mode-toggle` | `enable: boolean` | `{ success: boolean, log: string }` | Directly calls `runGameModeToggle(enable)`. |
| 82| `winboat-detect` | None | `{ success: boolean }` | Checks if the `winboat` executable is available in user system PATH directories. |
| 83| `winboat-run` | `exePath: string` | `{ success: boolean, output: string }` | Launches Windows sandbox executable background container with Xwayland/GPU rendering permissions: `winboat run --gpu --xwayland <path>`. |

*Note: This module also defines the exported orchestrator utility:*
- **`runGameModeToggle(enable: boolean)`**: Implements the VRAM squeeze, SCX loader switch to "lavd" scheduler, and sets core affinities using taskset (pins Ollama and ComfyUI tasks to core range 8-15 during game sessions to dedicate cores 0-7 to games).

---

### Domain H: Desktop Launcher & Startup (`system-desktop.ts`) - 8 Handlers
Manages user startup items, desktop application launches, and retrieves Arch Linux News RSS.

| # | IPC Handler Channel Name | Input Parameter Shape | Output Type / Response Shape | Primary Logic / Commands Executed |
|---|--------------------------|-----------------------|------------------------------|-----------------------------------|
| 84| `startup-list` | None | `{ desktopEntries: Array, systemdServices: Array }` | Scans `.desktop` configurations under `~/.config/autostart/` and lists user service statuses from `systemctl --user`. |
| 85| `startup-toggle-desktop`| `{ path: string, enabled: boolean }` | `{ success: boolean, error?: string }` | Updates standard desktop entries: toggles properties `X-GNOME-Autostart-enabled` and `Hidden`. |
| 86| `startup-delete-desktop`| `filePath: string` | `{ success: boolean, error?: string }` | Removes desktop autostart configuration from `~/.config/autostart/`. |
| 87| `startup-toggle-systemd`| `{ unit: string, enable: boolean }` | `{ success: boolean, error?: string }` | Registers or deregisters user services: `systemctl --user enable/disable <unit>`. |
| 88| `startup-add-desktop` | `{ name, exec, comment? }` | `{ success: boolean, path?, error? }` | Creates custom autostart applications entries. |
| 89| `apps-list` | None | `{ success: boolean, apps: Array<{name, exec, comment, categories, icon, path}> }` | Scans desktop configurations from system app directories (e.g. `/usr/share/applications`) to compile launcher shortcuts lists. |
| 90| `apps-launch` | `{ exec: string }` | `{ success: boolean, error?: string }` | Launches applications in detached mode: `spawn('bash', ['-c', <cleanExec>])`. |
| 91| `arch-news-fetch` | None | `{ success: boolean, items: Array<{title, link, date, summary}> }` | Downloads the Arch Linux RSS XML feed, parsing item contents via regular expressions. |

---

### Domain I: System Security, Backups, & Config Vault (`system-security.ts`) - 19 Handlers
Manages the backup vault, UFW firewall configurations, SSH key keys, and cron entries.

| # | IPC Handler Channel Name | Input Parameter Shape | Output Type / Response Shape | Primary Logic / Commands Executed |
|---|--------------------------|-----------------------|------------------------------|-----------------------------------|
| 92| `vault-list-backups` | None | `{ success: boolean, backups: Array<{filename, ts, path}> }` | Lists backups under `~/Vortex-Backups` ending in `.tar.gz`. |
| 93| `vault-create` | `{ paths: string[] }` | `{ success: boolean, filename?: string }` | Creates a compressed archive package of user configurations via `tar -czf`. |
| 94| `vault-restore` | `{ filename: string }` | `{ success: boolean, error?: string }` | Extracts configuration backups into root: `tar -xzf <file> -C /`. |
| 95| `vault-delete` | `{ filename: string }` | `{ success: boolean, error?: string }` | Removes archive backup file. |
| 96| `vault-get-sync-config`  | None | `{ success: boolean, config: { remoteName, remotePath }\|null }` | Reads cloud sync rclone destinations from table `vault_sync_config` in database. |
| 97| `vault-save-sync-config` | `{ remoteName, remotePath }` | `{ success: boolean, error?: string }` | Saves cloud sync target information in DB table. |
| 98| `vault-sync-backup` | `{ filename: string }` | `{ success: boolean, error?: string }` | Uploads archive file using rclone copying tasks: `rclone copy <file> <remote>`. |
| 99| `vault-list-remote` | None | `{ success: boolean, backups: Array<{filename}>, error? }` | Queries remote rclone directories: `rclone lsf <remote>`. |
| 100| `vault-download-remote` | `{ filename: string }` | `{ success: boolean, error?: string }` | Downloads backup package from remote via rclone copy. |
| 101| `ufw-status` | None | `{ success: boolean, enabled: boolean, rules: Array, raw: string }` | Reads active firewall status details: `pkexec ufw status verbose`. |
| 102| `ufw-enable` | `enable: boolean` | `{ success: boolean, output: string }` | Activates or deactivates firewall rules: `pkexec ufw enable/disable`. |
| 103| `ufw-add-rule` | `{ port, proto, action, from, comment }` | `{ success: boolean, error?: string }` | Adds a port rule specification to firewall database configuration: `pkexec ufw <action> <rules>`. |
| 104| `ufw-delete-rule` | `num: number` | `{ success: boolean, error?: string }` | Deletes a firewall rule by rule list index. |
| 105| `ssh-list-keys` | None | `{ success: boolean, keys: Array<{name, pubFile, privFile, type, fingerprint, comment, pubKey}> }` | Scans `~/.ssh` for public keys and extracts SSH parameters and fingerprints via `ssh-keygen -lf`. |
| 106| `ssh-generate-key` | `{ type, bits?, comment, filename }` | `{ success: boolean, error?: string }` | Generates a new SSH key: `ssh-keygen -t <type> [-b <bits>] -C <comment> -f <file> -N ""`. |
| 107| `ssh-delete-key` | `{ name: string }` | `{ success: boolean, error?: string }` | Removes private and public key files. |
| 108| `cron-list` | None | `{ success: boolean, entries: Array, error? }` | Parses user's crontab entries: `crontab -l`. |
| 109| `cron-save` | `{ entries: Array }` | `{ success: boolean, error?: string }` | Writes entries to system user crontab registry: `crontab -`. |

---

## 4. Proposed Partition and Migration Plan

To split `electron/system.ts` seamlessly, we will use an **aggregator strategy** that keeps interface boundaries completely intact.

### Step 1: Create `electron/system-common.ts`
This contains shared utilities and variables:
- Define `execPromise = promisify(exec)`.
- Define `detectAurHelper(...)`.
- Re-export `db` from `./db`.
- Export `createSystemHelpers(win)` returning `notify`, `streamLog`, `runStreamingCmd` instances scoped to the BrowserWindow.

### Step 2: Implement Domain Files
Create the nine separate domain files. Each file should structured as:
```typescript
import { ipcMain } from 'electron'
// ... (Node core, third-party imports)
import { execPromise, detectAurHelper, createSystemHelpers } from './system-common'

export function setupDomainHandlers(win: any) {
  const { notify, streamLog, runStreamingCmd } = createSystemHelpers(win)

  // ipcMain.handle(...) registrations for this domain
}
```

- **`system-media.ts`**: Move handlers 1–8.
- **`system-maintenance.ts`**: Move handlers 9–20.
- **`system-hardware.ts`**: Move handlers 21–38.
- **`system-docker.ts`**: Move handlers 39–45, plus the `parseServicesFromYaml` helper.
- **`system-packages.ts`**: Move handlers 46–60.
- **`system-btrfs.ts`**: Move handlers 61–69, plus the `parseBtrfsSize` helper.
- **`system-ai.ts`**: Move handlers 70–80 and 82–83. Also implement and export `runGameModeToggle` here.
- **`system-desktop.ts`**: Move handlers 84–91.
- **`system-security.ts`**: Move handlers 92–109.

### Step 3: Rewrite `electron/system.ts` as the Central Entry Point
To minimize changes and ensure backward compatibility, replace `electron/system.ts` with the following clean aggregator:

```typescript
import { setupMediaHandlers } from './system-media'
import { setupMaintenanceHandlers } from './system-maintenance'
import { setupHardwareHandlers } from './system-hardware'
import { setupDockerHandlers } from './system-docker'
import { setupPackagesHandlers } from './system-packages'
import { setupBtrfsHandlers } from './system-btrfs'
import { setupAiHandlers } from './system-ai'
import { setupDesktopHandlers } from './system-desktop'
import { setupSecurityHandlers } from './system-security'

// Re-export runGameModeToggle so VortexGuardian.ts continues working unmodified
export { runGameModeToggle } from './system-ai'

// Re-export setupSystemHandlers for main.ts
export function setupSystemHandlers(win: any) {
  setupMediaHandlers(win)
  setupMaintenanceHandlers(win)
  setupHardwareHandlers(win)
  setupDockerHandlers(win)
  setupPackagesHandlers(win)
  setupBtrfsHandlers(win)
  setupAiHandlers(win)
  setupDesktopHandlers(win)
  setupSecurityHandlers(win)
}
```

### Verification & Testing
After splitting the file:
1. Run the TypeScript compiler/linter on the electron folder to verify there are no missing imports or syntax errors:
   `npm run build` or `npx tsc --noEmit` inside the workspace.
2. Confirm that electron launches without errors.
3. Test a handler from each domain (e.g., checking system updates, listing docker containers, toggling game mode, or viewing snapshots) to ensure the IPC communication routes function exactly as before.
