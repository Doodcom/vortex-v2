import { Minus, Square, X } from 'lucide-react'

export default function WindowControls() {
  const control = (action: 'minimize' | 'maximize' | 'close') => {
    window.electron.windowControl(action)
  }

  return (
    <div className="flex items-center no-drag h-full">
      <button 
        onClick={() => control('minimize')}
        className="px-4 h-full hover:bg-white/5 transition-colors group"
      >
        <Minus className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200" />
      </button>
      <button 
        onClick={() => control('maximize')}
        className="px-4 h-full hover:bg-white/5 transition-colors group"
      >
        <Square className="w-3 h-3 text-zinc-500 group-hover:text-zinc-200" />
      </button>
      <button 
        onClick={() => control('close')}
        className="px-4 h-full hover:bg-red-500/80 transition-colors group"
      >
        <X className="w-4 h-4 text-zinc-500 group-hover:text-white" />
      </button>
    </div>
  )
}
