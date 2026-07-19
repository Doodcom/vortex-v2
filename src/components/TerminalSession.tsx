import { useRef, useEffect, } from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { parseAnsi, spansToStyle, type AnsiSpan } from '../lib/ansi'

interface TermEntry { id: number; command: string; dir: string; output: string; exitCode: number | null }

function AnsiLine({ text }: { text: string }) {
  const spans = parseAnsi(text)
  return <>{spans.map((s: AnsiSpan, i: number) => <span key={i} style={spansToStyle(s)}>{s.text}</span>)}</>
}

interface TerminalSessionProps {
  id: string
  name: string
  entries: TermEntry[]
  cwd: string
  history: string[]
  histIdx: number
  alive: boolean
  active: boolean
  input: string
  setInput: (v: string) => void
  onExecute: (cmd: string) => void
  onClear: () => void
  ghostSuffix: string
  matchedIds: Set<number> | null
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void
  onFocus: () => void
}

export default function TerminalSession({
  entries, active, input, setInput, ghostSuffix, matchedIds, onKeyDown, onPaste, onFocus, onClear
}: TerminalSessionProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (active) inputRef.current?.focus()
  }, [active])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [entries.length])

  return (
    <div 
      onClick={onFocus}
      style={{ 
        flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%',
        border: active ? '1px solid rgba(239,68,68,0.2)' : '1px solid transparent',
        background: active ? 'rgba(255,255,255,0.02)' : 'transparent',
        borderRadius: '12px', overflow: 'hidden', transition: 'all 0.2s'
      }}
    >
      {/* Scrollback */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
        <AnimatePresence initial={false}>
          {entries.map(entry => {
            const isMatch = matchedIds === null || matchedIds.has(entry.id)
            return (
              <motion.div key={entry.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: isMatch ? 1 : 0.2, y: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--crimson)', fontWeight: 'bold' }}>vortex</span>
                  <span style={{ color: '#2a2a2a' }}>:</span>
                  <span style={{ color: 'var(--signal)' }}>{entry.dir.replace(/^\/home\/[^/]+/, '~')}</span>
                  <span style={{ color: '#555' }}>$</span>
                  <span style={{ color: '#f4f4f5' }}>{entry.command}</span>
                  {entry.exitCode === null && (
                    <span style={{ display: 'inline-block', width: '6px', height: '12px', background: 'var(--crimson)', opacity: 0.8 }} className="animate-pulse" />
                  )}
                </div>

                {entry.output && (
                  <pre style={{ margin: '0 0 0 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '11px', lineHeight: '1.5', color: '#a1a1aa', maxHeight: '300px', overflowY: 'auto' }}>
                    {entry.output.split('\n').map((line, i) => (
                      <span key={i} style={{ display: 'block' }}><AnsiLine text={line} /></span>
                    ))}
                  </pre>
                )}

                {entry.exitCode !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '12px' }}>
                    {entry.exitCode !== 0 && (
                      <span style={{ fontSize: '8px', color: '#f87171', fontFamily: 'monospace', textTransform: 'uppercase' }}>exit {entry.exitCode}</span>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ChevronRight size={12} style={{ color: 'var(--crimson)', flexShrink: 0 }} />
        <div style={{ flex: 1, position: 'relative', height: '18px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none', userSelect: 'none' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'transparent', whiteSpace: 'pre' }}>{input}</span>
            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#3f3f46', whiteSpace: 'pre' }}>{ghostSuffix}</span>
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={ghostSuffix ? '' : '...'}
            style={{ position: 'absolute', inset: 0, background: 'transparent', border: 'none', outline: 'none', color: '#f4f4f5', fontSize: '12px', fontFamily: 'monospace', width: '100%' }}
          />
        </div>
        <button onClick={onClear} title="Clear" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3f3f46', display: 'flex' }}>
          <RotateCcw size={10} />
        </button>
      </div>
    </div>
  )
}
