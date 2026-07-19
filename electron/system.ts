/* eslint-disable @typescript-eslint/no-explicit-any */
import { setupHardwareHandlers } from './system-hardware'
import { setupMaintenanceHandlers } from './system-maintenance'
import { setupPackagesHandlers } from './system-packages'
import { setupBtrfsHandlers } from './system-btrfs'
import { setupDockerHandlers } from './system-docker'
import { setupTuningHandlers } from './system-tuning'
import { setupDesktopHandlers } from './system-desktop'
import { setupSecurityHandlers } from './system-security'

export function setupSystemHandlers(win: any) {
  setupHardwareHandlers(win)
  setupMaintenanceHandlers(win)
  setupPackagesHandlers(win)
  setupBtrfsHandlers(win)
  setupDockerHandlers(win)
  setupTuningHandlers()
  setupDesktopHandlers(win)
  setupSecurityHandlers(win)
}

export { runGameModeToggle } from './system-tuning'
