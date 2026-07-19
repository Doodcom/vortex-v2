import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Shield, Clock, Zap, Loader2, CheckCircle2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react'
import { cn } from '../lib/utils'

export default function CleanerView() {
  const [isCleaning, setIsCleaning] = useState(false)
  const [result, setResult] = useState<{ success: boolean, output?: string, error?: string } | null>(null)

  // Smart Cache Scanner states
  const [isScanning, setIsScanning] = useState(false)
  const [categories, setCategories] = useState<{ name: string; sizeBytes: number; paths: string[] }[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const runCleanup = async (type: 'cache' | 'orphans' | 'logs' | 'all') => {
    setIsCleaning(true)
    setResult(null)
    try {
      const res = await window.electron.systemCleanup(type)
      setResult(res)
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setIsCleaning(false)
    }
  }

  const scanCache = async () => {
    setIsScanning(true)
    setResult(null)
    try {
      const res = await window.electron.systemCleanupAnalyze()
      if (res.success && res.categories) {
        setCategories(res.categories)
        setSelectedCategories(res.categories.map((c) => c.name))
      } else {
        setResult({ success: false, error: res.error || 'Failed to scan storage.' })
      }
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setIsScanning(false)
    }
  }

  const executeSelectedCleanup = async () => {
    if (selectedCategories.length === 0) return
    setIsCleaning(true)
    setResult(null)
    try {
      const res = await window.electron.systemCleanupExecute(selectedCategories)
      if (res.success) {
        setResult({ success: true, output: res.logs })
        setCategories([])
        setSelectedCategories([])
      } else {
        setResult({ success: false, error: res.error || 'Failed to execute cleanup.' })
      }
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setIsCleaning(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const toggleSelect = (name: string) => {
    if (selectedCategories.includes(name)) {
      setSelectedCategories(selectedCategories.filter(n => n !== name))
    } else {
      setSelectedCategories([...selectedCategories, name])
    }
  }

  const toggleSelectAll = () => {
    if (selectedCategories.length === categories.length) {
      setSelectedCategories([])
    } else {
      setSelectedCategories(categories.map(c => c.name))
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CleanupCard 
          icon={Clock}
          title="System Logs"
          description="Vacuum journalctl logs older than 3 days to reclaim space."
          onClick={() => runCleanup('logs')}
          loading={isCleaning}
          color="text-signal"
        />
        <CleanupCard 
          icon={Zap}
          title="Package Cache"
          description="Clear old versions of installed packages using paccache."
          onClick={() => runCleanup('cache')}
          loading={isCleaning}
          color="text-amber-500"
        />
        <CleanupCard 
          icon={Shield}
          title="Orphaned Packages"
          description="Remove packages that were installed as dependencies but no longer needed."
          onClick={() => runCleanup('orphans')}
          loading={isCleaning}
          color="text-crimson"
        />
        <CleanupCard 
          icon={Trash2}
          title="Deep Cleanup"
          description="Perform all cleaning operations at once for maximum efficiency."
          onClick={() => runCleanup('all')}
          loading={isCleaning}
          color="text-white"
          featured
        />
      </div>

      {/* Smart Cache Scanner Section */}
      <div className="p-6 rounded-3xl border border-white/5 bg-white/5 flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-wide flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Smart Cache Scanner</span>
            </h2>
            <p className="text-zinc-500 text-xs">
              Scan system logs, pacman cache, and top user cache directories.
            </p>
          </div>
          <button
            onClick={scanCache}
            disabled={isScanning || isCleaning}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all font-bold text-xs uppercase tracking-wider disabled:opacity-50 animate-none"
          >
            {isScanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>{isScanning ? 'Scanning...' : 'Scan Cache'}</span>
          </button>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <label className="flex items-center space-x-2 cursor-pointer text-xs font-bold text-zinc-400">
                <input
                  type="checkbox"
                  checked={selectedCategories.length === categories.length}
                  onChange={toggleSelectAll}
                  className="rounded border-zinc-700 bg-zinc-800 text-crimson focus:ring-crimson focus:ring-offset-zinc-900"
                />
                <span>Select All ({categories.length} folders found)</span>
              </label>
              <span className="text-xs font-bold text-zinc-400">
                Total reclaimable: {formatSize(categories.filter(c => selectedCategories.includes(c.name)).reduce((sum, c) => sum + c.sizeBytes, 0))}
              </span>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {categories.map((cat) => (
                <div key={cat.name} className="p-4 rounded-2xl bg-black/20 border border-white/5 flex flex-col space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.name)}
                        onChange={() => toggleSelect(cat.name)}
                        className="mt-1 rounded border-zinc-700 bg-zinc-800 text-crimson focus:ring-crimson focus:ring-offset-zinc-900"
                      />
                      <div>
                        <div className="font-bold text-sm uppercase tracking-wide">{cat.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono break-all">{cat.paths.join(', ')}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-xs font-bold text-zinc-300">{formatSize(cat.sizeBytes)}</span>
                    </div>
                  </div>

                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={executeSelectedCleanup}
                disabled={selectedCategories.length === 0 || isCleaning}
                className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-crimson hover:bg-crimson-hover transition-all font-bold text-xs uppercase tracking-wider disabled:opacity-50"
              >
                {isCleaning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Clear Selected Cache</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              "p-6 rounded-3xl border flex flex-col space-y-4",
              result.success ? "bg-emerald-500/10 border-emerald-500/20" : "bg-crimson/10 border-crimson/20"
            )}
          >
            <div className="flex items-center space-x-3">
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-crimson" />
              )}
              <h3 className={cn("font-bold uppercase tracking-wider", result.success ? "text-emerald-500" : "text-crimson")}>
                {result.success ? "Cleanup Protocol Successful" : "Cleanup Protocol Failed"}
              </h3>
            </div>
            <pre className="text-[10px] font-mono text-zinc-400 bg-black/40 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
              {result.output || result.error}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface CleanupCardProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  onClick: () => void
  loading: boolean
  color: string
  featured?: boolean
}

function CleanupCard({ icon: Icon, title, description, onClick, loading, color, featured }: CleanupCardProps) {
  return (
    <button 
      onClick={onClick}
      disabled={loading}
      className={cn(
        "p-6 rounded-3xl border transition-all text-left relative group overflow-hidden",
        featured ? "bg-crimson/10 border-crimson/30 hover:bg-crimson/20" : "bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/[0.08]"
      )}
    >
      <div className={cn("p-3 rounded-xl bg-black/40 border border-white/5 w-fit mb-4", color)}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-bold text-lg mb-2 uppercase italic">{title}</h3>
      <p className="text-zinc-500 text-xs leading-relaxed">{description}</p>
      
      {loading && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}
    </button>
  )
}
