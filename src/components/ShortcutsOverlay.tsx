import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Keyboard, X } from 'lucide-react'

interface ShortcutsOverlayProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const SECTIONS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl', 'P'],       desc: 'Command palette' },
      { keys: ['Ctrl', '1–9'],     desc: 'Jump to nav item' },
      { keys: ['Ctrl', '`'],       desc: 'Terminal' },
    ],
  },
  {
    title: 'AI / Chat',
    shortcuts: [
      { keys: ['Ctrl', 'Shift', 'N'], desc: 'New chat session' },
      { keys: ['Enter'],               desc: 'Send message' },
      { keys: ['Shift', 'Enter'],      desc: 'Newline in message' },
    ],
  },
  {
    title: 'Global',
    shortcuts: [
      { keys: ['?'],      desc: 'Show this overlay' },
      { keys: ['Escape'], desc: 'Close overlay / palette' },
    ],
  },
]

export default function ShortcutsOverlay({ isOpen, setIsOpen }: ShortcutsOverlayProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable
      if (e.key === '?' && !isTyping && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setIsOpen(!isOpen)
      }
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, setIsOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => setIsOpen(false)}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -16 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 w-full max-w-lg bg-ink-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-2.5">
                <Keyboard size={15} className="text-crimson" />
                <span className="text-xs font-mono text-zinc-300 uppercase tracking-widest">Keyboard Shortcuts</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Sections */}
            <div className="p-5 flex flex-col gap-5">
              {SECTIONS.map(section => (
                <div key={section.title}>
                  <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-2.5">{section.title}</div>
                  <div className="flex flex-col gap-1">
                    {section.shortcuts.map((s, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-white/3 transition-colors">
                        <span className="text-[11px] font-mono text-zinc-400">{s.desc}</span>
                        <div className="flex items-center gap-1">
                          {s.keys.map((k, ki) => (
                            <span key={ki} className="flex items-center gap-1">
                              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-zinc-400 min-w-[24px] text-center">
                                {k}
                              </kbd>
                              {ki < s.keys.length - 1 && (
                                <span className="text-[9px] text-zinc-700">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-white/5 bg-black/20 flex items-center justify-between">
              <span className="text-[9px] font-mono text-zinc-700 uppercase">Press ? to toggle</span>
              <span className="text-[9px] font-mono text-zinc-700 uppercase">Vortex V2</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
