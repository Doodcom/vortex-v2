import {
  LayoutDashboard, Zap, Trash2, Rocket,
  Package,
  Terminal as TerminalIcon, Settings, Server, Activity, Wifi,
  Clock, HardDrive, ShieldCheck, ScrollText, Box, Layers,
  Cpu, Camera, LineChart, GitBranch, KeyRound, FlameKindling, Archive, HeartPulse
} from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>
}

export interface NavCategory {
  label: string
  items: NavItem[]
}

export const navCategories: NavCategory[] = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard',   label: 'Dashboard',       icon: LayoutDashboard },
    ]
  },
  {
    label: 'Performance',
    items: [
      { id: 'optimizer', label: 'Optimizer', icon: Rocket },
      { id: 'scheduler', label: 'Scheduler',    icon: Cpu },
      { id: 'updates', label: 'Updates', icon: Zap },
      { id: 'cleaner',   label: 'Cleaner',         icon: Trash2 },
      { id: 'snapshots', label: 'Restore Points',   icon: Camera },
    ]
  },
  {
    label: 'System',
    items: [
      { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
      { id: 'processes', label: 'Processes', icon: Activity },
      { id: 'services',  label: 'Services',  icon: Server },
      { id: 'packages', label: 'Packages', icon: Package },
      { id: 'depgraph', label: 'Dep Graph', icon: Layers },
      { id: 'docker',    label: 'Docker',      icon: Box },
    ]
  },
  {
    label: 'Diagnostics',
    items: [
      { id: 'network',   label: 'Network',   icon: Wifi },
      { id: 'disk',      label: 'Disk Monitor',  icon: HardDrive },
      { id: 'boot',      label: 'Boot Analyser', icon: Clock },
      { id: 'history',   label: 'Sys History',   icon: LineChart },
      { id: 'health',    label: 'Health Report', icon: HeartPulse },
      { id: 'audit',     label: 'Audit Log',     icon: ShieldCheck },
      { id: 'logs',      label: 'Log Viewer',    icon: ScrollText },
    ]
  },
  {
    label: 'Automation',
    items: [
      { id: 'automations', label: 'Automation', icon: GitBranch },
      { id: 'ssh', label: 'SSH Keys', icon: KeyRound },
      { id: 'firewall', label: 'Firewall (UFW)', icon: FlameKindling },
      { id: 'vault', label: 'Dotfile Vault', icon: Archive },
    ]
  },
  {
    label: 'Config',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings },
    ]
  }
]

export const navItems = navCategories.flatMap(c => c.items)
