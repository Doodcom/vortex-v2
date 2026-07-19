import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HardDrive, Shield, Loader2, Zap, RefreshCw, Cpu, Box } from 'lucide-react'
import { cn } from '../lib/utils'
import { notify } from '../lib/notifications'

export default function OptimizerView() {
  const [isOptimizing, setIsOptimizing] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, any>>({})
  const [genericPkgs, setGenericPkgs] = useState<{ name: string; repo: string }[]>([])
  const [isAuditing, setIsAuditing] = useState(false)
  const [rebuildTarget, setRebuildLog] = useState<string | null>(null)

  const runAudit = async () => {
    setIsAuditing(true)
    const res = await window.electron.systemAuditArch()
    setIsAuditing(false)
    if (res.success) {
      setGenericPkgs(res.packages)
      if (res.packages.length === 0) notify('Audit', 'Your system is fully optimized for x86-64-v4!', 'success')
    }
  }

  const runRebuild = async (pkg: string) => {
    setRebuildLog(pkg)
    const res = await window.electron.systemRebuildNative(pkg)
    setRebuildLog(null)
    if (res.success) {
      notify('Optimizer', `${pkg} successfully rebuilt for Zen 4`, 'success')
      setGenericPkgs(prev => prev.filter(p => p.name !== pkg))
    }
  }

  const runOptimize = async (id: string) => {
    setIsOptimizing(id)
    try {
      const res = await window.electron.systemOptimize(id as any)
      setResults(prev => ({ ...prev, [id]: res }))
    } catch (e: any) {
      setResults(prev => ({ ...prev, [id]: { success: false, error: e.message } }))
    } finally {
      setIsOptimizing(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      
      {/* 2026 Zen 4 Auditor */}
      <div className="glass rounded-3xl border border-cyan-500/10 overflow-hidden bg-gradient-to-br from-cyan-500/5 to-transparent">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg uppercase italic text-white">x86-64-v4 Architecture Auditor</h3>
              <p className="text-zinc-500 text-xs">Identify generic binaries and rebuild them natively for your Zen 4 CPU.</p>
            </div>
          </div>
          <button 
            onClick={runAudit}
            disabled={isAuditing}
            className="px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 transition-all"
          >
            {isAuditing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Run Silicon Audit"}
          </button>
        </div>

        <AnimatePresence>
          {genericPkgs.length > 0 && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="px-6 pb-6">
              <div className="bg-black/40 rounded-2xl border border-white/5 p-4 flex flex-col gap-2">
                <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2 px-2 flex justify-between">
                  <span>Detected Generic Packages</span>
                  <span>Zen 4 Performance Potential: ~8%</span>
                </div>
                {genericPkgs.map(pkg => (
                  <div key={pkg.name} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-center gap-3">
                      <Box size={14} className="text-zinc-500" />
                      <div>
                        <div className="text-xs font-bold text-zinc-300">{pkg.name}</div>
                        <div className="text-[8px] font-mono text-zinc-600">Source: {pkg.repo} (Generic x86_64)</div>
                      </div>
                    </div>
                    <button
                      onClick={() => runRebuild(pkg.name)}
                      disabled={!!rebuildTarget}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[9px] font-bold uppercase border border-emerald-500/20 transition-all flex items-center gap-2"
                    >
                      {rebuildTarget === pkg.name ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                      {rebuildTarget === pkg.name ? "Rebuilding..." : "Nativize"}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8">
        <OptCard 
          id="ssd"
          icon={HardDrive}
          title="SSD TRIM Optimization"
          description="Send TRIM commands to all mounted filesystems to maintain SSD performance."
          onClick={() => runOptimize('ssd')}
          loading={isOptimizing === 'ssd'}
          result={results['ssd']}
          color="text-signal"
        />
        <OptCard 
          id="services"
          icon={Shield}
          title="Service State Reset"
          description="Reset failed systemd services to clear error states in system status."
          onClick={() => runOptimize('services')}
          loading={isOptimizing === 'services'}
          result={results['services']}
          color="text-amber-500"
        />
        <OptCard 
          id="performance"
          icon={Zap}
          title="Performance Governor"
          description="Set CPU frequency scaling governor to 'performance' for maximum throughput."
          onClick={() => runOptimize('performance')}
          loading={isOptimizing === 'performance'}
          result={results['performance']}
          color="text-crimson"
        />
      </div>
    </div>
  )
}

function OptCard({ icon: Icon, title, description, onClick, loading, result, color }: any) {
  return (
    <div className="glass rounded-3xl border border-white/5 overflow-hidden transition-all hover:border-white/10">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className={cn("p-4 rounded-2xl bg-black/40 border border-white/5", color)}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg uppercase italic">{title}</h3>
            <p className="text-zinc-500 text-xs">{description}</p>
          </div>
        </div>
        <button 
          onClick={onClick}
          disabled={loading}
          className={cn(
            "px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all",
            loading ? "bg-zinc-800 text-zinc-500" : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Execute"}
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            className="px-6 pb-6"
          >
            <div className={cn(
              "p-4 rounded-xl border font-mono text-[10px] whitespace-pre-wrap",
              result.success ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-500/70" : "bg-crimson/5 border-crimson/10 text-crimson/70"
            )}>
              {result.success ? (result.output || "Command executed successfully") : (result.error || "Execution failed")}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
