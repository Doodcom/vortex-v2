# Reddit announcement drafts

## r/cachyos

**Title:** I built a system updater & tuner GUI for CachyOS — live sched-ext switching, snapper-backed upgrades, now on the AUR (vortex-v2)

**Body:**

I've been building a desktop app to manage my own CachyOS box for months and finally cleaned it up into something shareable: **Vortex V2**.

The two features I actually built it for:

- **Live sched-ext switching** — see the loaded scheduler, flip between bpfland / lavd / rusty via the scx_loader D-Bus API, no reboot. BORE sysctl presets (desktop / balanced / gaming) and a one-click Game Mode that toggles lavd and back.
- **Snapshot-backed upgrades** — full repo + AUR upgrade (`paru -Syu`) with an automatic snapper pre-snapshot every time, so a bad kernel update is one rollback away. fwupd firmware updates and the Arch news feed in the same view so you catch manual-intervention notices first.

Beyond that it's a full maintenance suite: package manager UI with dependency graph, cache/orphan cleaner, Btrfs scrub/balance, systemd services, docker, UFW, journal viewer, boot analyser, SMART monitoring, dotfile vault with rclone sync, built-in terminal with an audit log.

**Being upfront about the trade-offs:** upgrades run `--noconfirm` (GUI, no tty for prompts) — the pre-snapshot is the safety net, and the [manual](https://github.com/Doodcom/vortex-v2/blob/main/MANUAL.md) documents the exact command behind every single button. Privileged actions go through pkexec/polkit, and the app makes zero network calls of its own. Yes, it's Electron — it's also what let me ship this solo, and it's snappy.

Everything feature-detects its backing tool (snapper, scx-scheds, fwupd, ufw, docker…) and degrades cleanly, so it runs on any Arch-based distro, but CachyOS is the target.

**Install:** `paru -S vortex-v2`, or prebuilt `.pacman` / AppImage from the [GitHub release](https://github.com/Doodcom/vortex-v2/releases/latest).

**Source:** https://github.com/Doodcom/vortex-v2 (MIT)

v1.0.1, young public build — bug reports and design disagreements genuinely welcome (an interactive-upgrade mode is on the table if people want it).

*(attach screenshots/dashboard.png and screenshots/scheduler.png as the image gallery, or post as image post with the body in a comment — r/cachyos allows link+text posts, so a text post with the raw.githubusercontent image links inline also works)*

---

## r/archlinux

**Note:** r/archlinux only allows project announcements in specific contexts — check current sub rules before posting; if self-promo posts are restricted, skip it or wait for a relevant thread. Shorter, drier version:

**Title:** Vortex V2 — GTK-free Electron GUI for pacman/AUR upgrades with automatic snapper pre-snapshots and sched-ext scheduler switching

**Body:**

Released a system-maintenance GUI I've been running privately for months. Highlights relevant here:

- `paru -Syu` upgrades with an automatic snapper pre-snapshot before every run; Arch news feed surfaced in the update view
- sched-ext scheduler switching at runtime via scx_loader D-Bus; BORE sysctl profiles
- Package UI (pacman/AUR/flatpak), orphan/cache cleaning, journal vacuum, Btrfs maintenance, systemd/UFW/docker views

Every button's underlying command is documented in the [manual](https://github.com/Doodcom/vortex-v2/blob/main/MANUAL.md). Known trade-off: upgrades use `--noconfirm` (documented, snapshot-backed). polkit for privilege, no telemetry, MIT.

AUR: `vortex-v2` · Source: https://github.com/Doodcom/vortex-v2

Feedback welcome, especially on the `--noconfirm` call.
