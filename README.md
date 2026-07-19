# Vortex V2

**A system updater and tuner suite for [CachyOS](https://cachyos.org/), built as a fast Electron desktop app.**

Vortex V2 wraps the maintenance work you'd normally do across half a dozen terminal commands into one dashboard: full system upgrades with automatic pre-upgrade snapshots, firmware updates, sched-ext scheduler switching, cache cleaning, and health monitoring.

Every button maps to a standard command you could type yourself — `pacman`, `paru`, `snapper`, `fwupdmgr`, `scx_loader`, `journalctl` — with the output streamed live into the app. Privileged actions go through polkit (`pkexec`); nothing runs as root silently, and the app makes no network calls of its own beyond the actions you trigger. **[Read the full manual](MANUAL.md)** for a view-by-view description of exactly what the app does under the hood.

## Features

**Updates**
- Full `pacman -Syu` / `paru -Syu` system upgrades — repo + AUR in one click, kernel included
- Automatic Snapper pre-upgrade snapshots (one rollback away from any bad update)
- Device firmware updates via fwupd/LVFS
- Arch news feed so you see breaking-change notices before you hit Upgrade

**Performance tuning**
- sched-ext (SCX) scheduler switching — bpfland, lavd, rusty and friends, live, no reboot
- BORE scheduler profile presets (desktop / balanced / gaming)
- One-click Game Mode: switches to the LAVD scheduler and back
- Power profile switching (power-profiles-daemon)
- x86-64-v4 optimizer view

**Maintenance**
- Smart cache scanner and cleaner (pacman cache, journals, user caches, orphans)
- Btrfs maintenance: scrub, balance, defrag, usage
- Snapper restore points: create, browse, rollback
- Guardian: background watchdog for disk pressure, failed units, and pending updates

**System tools**
- Package manager UI (pacman + AUR + Flatpak + AppImage) with dependency graph
- Processes, systemd services, Docker containers, network monitor
- Journal log viewer with filters, boot analyzer, SMART disk health
- Built-in terminal with audit log, cron/startup/automation manager
- SSH key manager, UFW firewall, dotfile vault with rclone sync
- System health report and resource history charts

## Install

### From the AUR (coming soon)

```bash
paru -S vortex-v2
```

### From source

```bash
git clone https://github.com/Doodcom/vortex-v2
cd vortex-v2
npm ci --legacy-peer-deps
npm run build
npx electron-builder --linux pacman
sudo pacman -U release/vortex-v2-*.pacman
```

### Recommended companions

Everything degrades gracefully if these are missing, but for the full experience:

```bash
sudo pacman -S --needed pacman-contrib snapper fwupd scx-scheds power-profiles-daemon ufw
```

### Polkit rule (optional, recommended)

A maintenance run chains several privileged commands. This rule makes polkit remember your password for ~5 minutes (like sudo) instead of prompting per command:

```bash
sudo bash scripts/install-polkit.sh
```

## Development

```bash
npm ci --legacy-peer-deps
npm run dev        # Vite + Electron dev mode
npm run lint
npm run test:e2e
```

## Requirements

- CachyOS (or any Arch-based distro — CachyOS-specific features like `chwd`, `cachyos-rate-mirrors`, and BORE/sched-ext detect availability and hide/degrade when absent)
- x86_64

## License

MIT
