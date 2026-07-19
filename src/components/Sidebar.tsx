import { Palette } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'
import { useTheme } from './ThemeProvider'

import { navCategories } from '../lib/navigation'

interface SidebarProps {
  activeTab: string
  setActiveTab: (id: string) => void
  isExpanded: boolean
  setIsExpanded: (expanded: boolean) => void
  cpuLoad: number
  sidebarWidth: number
}

export default function Sidebar({ activeTab, setActiveTab, isExpanded, setIsExpanded, cpuLoad, sidebarWidth }: SidebarProps) {
  const { theme, setTheme, playSound } = useTheme()

  const handleTabClick = (id: string) => {
    playSound('click')
    setActiveTab(id)
  }

  return (
    <aside
      className="v-sidebar"
      style={{ width: isExpanded ? sidebarWidth : 64 }}
    >
      <div className="h-14 flex items-center px-4 border-b border-white/5 drag">
        <div className="w-8 h-8 rounded-lg bg-crimson flex items-center justify-center mr-3 flex-shrink-0 crimson-glow shadow-[0_0_10px_rgba(239,68,68,0.3)]">
          <span className="font-bold text-white text-xs">V2</span>
        </div>
        {isExpanded && (
          <span className="font-bold tracking-widest text-[10px] uppercase truncate">
            Vortex <span className="text-zinc-500">//</span> V2
          </span>
        )}
      </div>

      <nav className="flex-1 py-4 overflow-y-auto no-drag space-y-6">
        {navCategories.map((cat) => (
          <div key={cat.label} className="space-y-1">
            {isExpanded && (
              <div className="px-6 py-2 flex items-center gap-3">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.25em] whitespace-nowrap">{cat.label}</span>
                <div className="h-[1px] flex-1 bg-white/5" />
              </div>
            )}
            <div className="space-y-0.5">
              {cat.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  onMouseEnter={() => playSound('hover')}
                  className={cn(
                    "v-nav-item",
                    activeTab === item.id && "active"
                  )}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <item.icon className={cn(
                      "w-3.5 h-3.5 transition-transform",
                      activeTab === item.id ? "crimson-glow text-crimson" : "text-zinc-500"
                    )} />
                    {!isExpanded && item.id === 'dashboard' && (
                      <div style={{
                        position: 'absolute', top: '-3px', right: '-4px',
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: cpuLoad > 85 ? 'var(--crimson)' : cpuLoad > 60 ? '#f59e0b' : 'var(--signal)',
                        boxShadow: `0 0 5px ${cpuLoad > 85 ? 'var(--crimson)' : cpuLoad > 60 ? '#f59e0b' : 'var(--signal)'}`,
                      }} />
                    )}
                  </div>
                  {isExpanded && (
                    <span className="ml-4 truncate text-[11px] font-medium normal-case tracking-normal">{item.label}</span>
                  )}
                  {activeTab === item.id && (
                    <motion.div 
                      layoutId="active-nav"
                      className="absolute left-0 w-[2px] h-4 bg-crimson rounded-r-full"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5 no-drag bg-black/20 space-y-3">
        {isExpanded && (
          <div className="flex items-center justify-between px-2 mb-2">
            <Palette size={12} className="text-zinc-500" />
            <div className="flex gap-1.5">
              {(['vortex-red', 'cyber-blue', 'neon-gold', 'matrix-green'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTheme(t); playSound('success'); }}
                  className={cn(
                    "w-3 h-3 rounded-full border border-white/10 transition-transform hover:scale-125",
                    t === 'vortex-red' && "bg-red-500",
                    t === 'cyber-blue' && "bg-cyan-400",
                    t === 'neon-gold' && "bg-amber-500",
                    t === 'matrix-green' && "bg-emerald-500",
                    theme.name === t && "ring-2 ring-white/20 ring-offset-2 ring-offset-ink-800"
                  )}
                />
              ))}
            </div>
          </div>
        )}
        <button 
          onClick={() => { setIsExpanded(!isExpanded); playSound('click'); }}
          className="w-full h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors text-zinc-600 hover:text-zinc-300"
        >
          <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
            {isExpanded ? "« Collapse" : "»"}
          </span>
        </button>
      </div>
    </aside>
  )
}
