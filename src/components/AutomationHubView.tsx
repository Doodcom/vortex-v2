import { useState } from 'react'
import { GitBranch, CalendarClock, Power } from 'lucide-react'
import AutomationsView from './AutomationsView'
import CronView from './CronView'
import StartupView from './StartupView'

type HubTab = 'workflows' | 'cron' | 'startup'

const TABS: { id: HubTab; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }[] = [
  { id: 'workflows', label: 'Workflows', icon: GitBranch },
  { id: 'cron', label: 'Cron Jobs', icon: CalendarClock },
  { id: 'startup', label: 'Startup Apps', icon: Power },
]

export default function AutomationHubView({ initialTab }: { initialTab?: HubTab }) {
  const [tab, setTab] = useState<HubTab>(initialTab ?? 'workflows')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 16px', borderRadius: '8px',
                fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', textTransform: 'uppercase',
                letterSpacing: '0.08em', cursor: 'pointer', transition: 'all 0.15s',
                background: active ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
                color: active ? 'var(--crimson)' : '#71717a',
              }}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'workflows' && <AutomationsView />}
      {tab === 'cron' && <CronView />}
      {tab === 'startup' && <StartupView />}
    </div>
  )
}
