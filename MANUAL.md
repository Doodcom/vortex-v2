# Vortex V2 — User Manual

Vortex V2 is a desktop control centre for CachyOS (and other Arch-based distros). Every action in the app maps to a standard system command you could run yourself in a terminal — this manual documents each view and exactly what it does under the hood, so you always know what's happening on your machine.

**Privilege model:** read-only actions (stats, lists, logs) run as your user. Anything that changes system state runs through `pkexec`, so polkit prompts for your password. Installing the optional polkit rule (`sudo bash scripts/install-polkit.sh`) makes polkit remember the password for ~5 minutes per session — like sudo — instead of prompting for every chained command.

**Data storage:** Vortex keeps its settings, audit log, and resource history in a local SQLite database at `~/.config/vortex-v2/vortex.db`. Nothing is sent anywhere; the only network calls the app makes are the ones you trigger (package downloads via pacman/paru, firmware metadata via fwupd/LVFS, the Arch news feed, and rclone if you configure Vault Sync).

---

## Overview

### Dashboard
Live system overview, refreshed every 2 seconds via the `systeminformation` library:
- **Metric cards** — CPU load, RAM, GPU (utilisation/VRAM/temps via the driver), storage, network throughput, with a live multi-line chart.
- **Game Mode** — one click switches the kernel to the `lavd` sched-ext scheduler (via the `scx_loader` D-Bus service); toggling off stops the SCX scheduler and returns to the default (BORE on CachyOS kernels).
- **Vortex Guardian** — background watchdog. Every 5 minutes it checks root-disk usage (warns at 90%) and failed systemd units; every 6 hours it checks for pending updates. It only notifies — it never acts on its own.
- **Power Mode** — switches profiles through `powerprofilesctl` (power-saver / balanced / performance).
- **Audit Trail** — recent commands executed through the app's terminal.
- Widgets can be hidden and sections drag-reordered; layout is remembered.

---

## Performance

### Updates
The heart of the app. What it does, in order, when you hit **Upgrade All**:
1. Creates a Snapper pre-snapshot of root (`snapper -c root create -t pre`) so any bad update is one rollback away (skipped gracefully if snapper isn't installed).
2. Runs a **full system upgrade**: `paru -Syu --noconfirm` (or `yay`, or `pkexec pacman -Syu --noconfirm` if no AUR helper is present). This is exactly equivalent to updating manually in a terminal — kernel, drivers, everything, repo + AUR in one pass. Output streams live into the app.
3. Runs `flatpak update -y` to bring installed Flatpak apps up to date too.

> **⚠️ About `--noconfirm`:** because this is a GUI, the upgrade auto-answers the prompts you'd see in a terminal — package replacements, provider choices, and AUR PKGBUILD review are all accepted with pacman/paru defaults. 99% of the time the result is identical to pressing Enter yourself, and the automatic pre-upgrade snapshot means any bad outcome is one rollback away. But if an Arch news post says an update needs manual intervention, do that intervention in a terminal first — the Arch News panel in this view exists exactly for that. `.pacnew` config files are also not merged for you (they aren't in a manual upgrade either); watch the streamed log for warnings.

Also in this view:
- **Update check** — `checkupdates` (repo, uses a separate DB so it never touches your sync state) + `paru -Qua` (AUR) + `flatpak remote-ls --updates` (Flatpak).
- **Device Firmware** — checks LVFS via `fwupdmgr get-updates` and applies with `fwupdmgr update`. Covers SSDs, peripherals, Secure Boot dbx — note most motherboard BIOSes are not on LVFS and still need the vendor tool.
- **Arch News** — feed from archlinux.org so you see manual-intervention notices *before* upgrading.

### Optimizer
- Detects whether your CPU supports x86-64-v3/v4 and whether the matching CachyOS optimized repos are active.
- One-shot tune-ups (`system-optimize`): SSD trim, disabling unneeded services, performance sysctl presets. Each shows the exact command before running.
- **Rebuild native packages** — rebuilds AUR packages against the current toolchain.

### Scheduler
CachyOS's killer feature, exposed in a UI:
- **sched-ext (SCX)** — shows the currently loaded scheduler, lets you switch between installed ones (`scx_bpfland`, `scx_lavd`, `scx_rusty`, …) live via the `org.scx.Loader` D-Bus API. No reboot, takes effect instantly. Live metrics from `/sys/kernel/sched_ext/`.
- **BORE profiles** — presets (desktop / balanced / gaming) that write `kernel.sched_burst_*` sysctls tuned for each workload. Only applies keys your kernel actually exposes.

### Cleaner
- **Quick clean** — `paccache -r -k 1` (package cache, keeps last version), orphan removal (`pacman -Rns $(pacman -Qtdq)`), journal vacuum (`journalctl --vacuum-time=3d`).
- **Smart Cache Scanner** — measures pacman cache, journals, and the largest `~/.cache` directories, shows sizes, and lets you pick categories to clear.

### Restore Points
Full Snapper UI: list snapshots with type/date/description, create manual snapshots, delete old ones, and roll back (`snapper rollback`, effective after reboot via the GRUB snapshot menu on CachyOS).

---

## System

### Terminal
A real shell (your login shell) inside the app, with tabs and split view. Every command is recorded to the local audit log with its exit code. Nothing runs elevated unless you use sudo/pkexec yourself.

### Processes
`ps`-style live process table — sort by CPU/RAM, send signals (TERM/KILL) to your own processes; killing others' prompts via pkexec.

### Services
All systemd units with state; start/stop/restart/enable/disable (`systemctl`, elevated via pkexec), and per-unit journal logs.

### Packages
- Search and install from the **repos** (`pacman`) and **AUR** (via paru/yay — AUR packages build as your user, never as root).
- **Flatpak** search/install/remove, plus an **Update All** button that appears whenever Flatpak updates are pending (`flatpak update -y`), and **AppImage** registration (adds .desktop entries for AppImages you point it at).
- Package info, file lists, and a jump into the Dep Graph.

### Dep Graph
Interactive dependency visualiser for any installed package (`pactree` data) — click a node to drill down.

### Docker
Container list with status, start/stop/restart, and log tail. Talks to the Docker CLI; needs your user in the `docker` group.

---

## Diagnostics

### Network
Interface stats, live throughput, and the open-connections table (who's talking to what, which process owns the socket).

### Disk Monitor
Drives, partitions, usage, and **SMART health** (`smartctl`) including NVMe wear metrics.

### Boot Analyser
`systemd-analyze` breakdown: total boot time, per-unit blame list, and critical chain.

### Sys History
24h resource history charts (CPU/RAM/GPU/disk/network), sampled every 30s into the local DB and pruned after ~25h.

### Health Report
One-click report: gathers load, memory, disk, journal errors, failed units, and pending updates into a scored summary with concrete recommendations. Score is computed deterministically from the data.

### Audit Log
Every command run through the app's terminal, with source, exit code, and timestamp. Clearable.

### Log Viewer
`journalctl` browser: filter by unit, priority, time range, and keyword; follow mode re-polls every 8 seconds.

---

## Automation

### Automation Hub
- **Workflows** — one-click maintenance actions (full upgrade, cache clean, journal vacuum, native rebuild, mirror ranking, snapshot) plus your own custom shell commands.
- **Cron** — view and edit your user crontab in a table UI.
- **Startup** — manage autostart: `~/.config/autostart` .desktop entries (toggle/add/delete) and user systemd units.

### SSH Keys
List keys in `~/.ssh`, generate new ones (`ssh-keygen`, ed25519 or RSA), copy the public key, delete pairs.

### Firewall (UFW)
Status, enable/disable, add/delete rules (port, protocol, source, comment) — a thin UI over `ufw`.

### Dotfile Vault
- Tar-based backups of chosen dotfiles/directories into a local vault, restore any backup.
- Optional **Vault Sync** to any rclone remote you've configured (your remote, your credentials — the app just invokes `rclone`).

---

## Config

### Settings
- **Interface** — colour accents, animated visual themes (CRT/Neon/Holo), sound effects, animation toggle.
- **System Safety** — manual Snapper snapshot button.
- **CachyOS Hardware** — `chwd` driver detection/install, `cachyos-rate-mirrors` mirror ranking, fingerprint reader (fprintd) status.
- **Resource Alerts** — per-metric thresholds (CPU/RAM/GPU VRAM) for desktop notifications, 5-minute cooldown, 0 disables.
- **About** — versions and stack info.

### Keyboard shortcuts
- `Ctrl+P` — command palette (fuzzy-jump to any view)
- `Ctrl+1…9` — jump to the first nine views
- ``Ctrl+` `` — terminal
- `F5` reload UI, `F12` devtools

---

## Graceful degradation

Vortex V2 assumes CachyOS but runs on any Arch-based distro. Features detect their backing tool and hide or report cleanly when it's missing:

| Feature | Needs |
|---|---|
| Update checks | `pacman-contrib` (checkupdates) |
| AUR updates/installs | `paru` or `yay` |
| Pre-upgrade snapshots / Restore Points | `snapper` (Btrfs) |
| Firmware updates | `fwupd` |
| Scheduler switching | CachyOS kernel + `scx-scheds` |
| BORE profiles | BORE-patched kernel (CachyOS default) |
| Firewall | `ufw` |
| Docker view | `docker` |
| Power modes | `power-profiles-daemon` |
| SMART data | `smartmontools` |
| Vault sync | `rclone` |
| chwd / mirror ranking | CachyOS |
