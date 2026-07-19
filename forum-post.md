**Title:** Vortex V2 — a system updater & tuner GUI built for CachyOS (sched-ext switching, snapper-backed upgrades) [v1.0.1]

---

Hi all,

I've been building a desktop app to manage my own CachyOS machine for months, and I've stripped it down and cleaned it up into something worth sharing. It's called **Vortex V2** — a system updater and tuner suite.

**What it does:**

- **One-click full system upgrade** — repo + AUR (`paru -Syu`), kernel included, with an **automatic snapper pre-snapshot** before every upgrade so a bad update is one rollback away. Firmware updates via fwupd, and the Arch news feed shown right in the Updates view so you see manual-intervention notices before you hit the button.
- **Live sched-ext scheduler switching** — see what's loaded, switch between bpfland / lavd / rusty etc. via the scx_loader D-Bus API, no reboot. Plus BORE sysctl profile presets (desktop / balanced / gaming) and a one-click Game Mode that flips to lavd and back.
- **Maintenance** — cache scanner/cleaner, orphan removal, journal vacuum, Btrfs scrub/balance/defrag, snapper restore point manager, and a background watchdog for disk pressure / failed units / pending updates (notify-only, it never acts on its own).
- **The rest** — package manager UI (pacman/AUR/flatpak/AppImage) with a dependency graph, systemd services, processes, docker, network/disk/SMART monitoring, journal viewer, boot analyser, UFW, SSH keys, dotfile vault with rclone sync, built-in terminal with audit log, health report.

**Transparency, because I know this crowd:** every button maps to a standard command, and the [manual](https://github.com/Doodcom/vortex-v2/blob/main/MANUAL.md) documents exactly what runs under the hood for every view. The big trade-off to know about: **upgrades run with `--noconfirm`** (it's a GUI — there's no tty to answer prompts), so replacements/provider choices/PKGBUILD review get pacman/paru defaults. The pre-upgrade snapshot is the safety net, and it's all documented up front rather than buried. Privileged actions go through pkexec/polkit — nothing runs as root silently, and the app makes zero network calls of its own.

It's Electron (I know, I know), but it's snappy, and it's what let me build this solo. Everything degrades gracefully — features detect their backing tool (snapper, fwupd, scx-scheds, ufw, docker…) and hide or report cleanly when it's missing, so it runs on any Arch-based distro even though CachyOS is the target.

**Screenshots:**

![Dashboard](https://raw.githubusercontent.com/Doodcom/vortex-v2/main/screenshots/dashboard.png)

![Scheduler](https://raw.githubusercontent.com/Doodcom/vortex-v2/main/screenshots/scheduler.png)

**Install:**

```
paru -S vortex-v2
```

or grab the prebuilt `.pacman` / AppImage from the [GitHub release](https://github.com/Doodcom/vortex-v2/releases/latest).

**Source:** https://github.com/Doodcom/vortex-v2 (MIT)

This is v1.0.1 — I've been running the internal version daily for months, but this public build is young, so I'd genuinely appreciate bug reports and rough edges. Issues on GitHub or replies here both work. And if you disagree with any of the design calls (looking at you, `--noconfirm`), I'm open to adding an interactive mode — tell me what you'd want.

Cheers 🌪️
