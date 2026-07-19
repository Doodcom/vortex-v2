// Full SGR ANSI colour/attribute parser → React-renderable spans

const ANSI_16 = [
  '#1a1a1a', '#cc0000', '#0dbc79', '#c4a000',
  '#2472c8', '#bc3fbc', '#11a8cd', '#cccccc',
  '#555555', '#f14c4c', '#23d18b', '#f5f543',
  '#3b8eea', '#d670d6', '#29b8db', '#e5e5e5',
]

function color256(n: number): string {
  if (n < 16) return ANSI_16[n]
  if (n >= 232) { const v = Math.round((n - 232) * 255 / 23); return `rgb(${v},${v},${v})` }
  const i = n - 16
  const b = i % 6, g = Math.floor(i / 6) % 6, r = Math.floor(i / 36)
  const s = (x: number) => x ? x * 40 + 55 : 0
  return `rgb(${s(r)},${s(g)},${s(b)})`
}

interface Attrs { fg: string | null; bg: string | null; bold: boolean; italic: boolean; underline: boolean; dim: boolean }
export interface AnsiSpan extends Attrs { text: string }

const RESET: Attrs = { fg: null, bg: null, bold: false, italic: false, underline: false, dim: false }

function applyCode(a: Attrs, codes: number[]): Attrs {
  a = { ...a }
  let i = 0
  while (i < codes.length) {
    const c = codes[i]
    if (c === 0)  { Object.assign(a, RESET) }
    else if (c === 1)  a.bold = true
    else if (c === 2)  a.dim = true
    else if (c === 3)  a.italic = true
    else if (c === 4)  a.underline = true
    else if (c === 22) { a.bold = false; a.dim = false }
    else if (c === 23) a.italic = false
    else if (c === 24) a.underline = false
    else if (c === 39) a.fg = null
    else if (c === 49) a.bg = null
    else if (c >= 30 && c <= 37)   a.fg = ANSI_16[c - 30]
    else if (c >= 40 && c <= 47)   a.bg = ANSI_16[c - 40]
    else if (c >= 90 && c <= 97)   a.fg = ANSI_16[c - 90 + 8]
    else if (c >= 100 && c <= 107) a.bg = ANSI_16[c - 100 + 8]
    else if (c === 38 && codes[i+1] === 5 && codes[i+2] != null) { a.fg = color256(codes[i+2]); i += 2 }
    else if (c === 48 && codes[i+1] === 5 && codes[i+2] != null) { a.bg = color256(codes[i+2]); i += 2 }
    else if (c === 38 && codes[i+1] === 2 && codes[i+4] != null) { a.fg = `rgb(${codes[i+2]},${codes[i+3]},${codes[i+4]})`; i += 4 }
    else if (c === 48 && codes[i+1] === 2 && codes[i+4] != null) { a.bg = `rgb(${codes[i+2]},${codes[i+3]},${codes[i+4]})`; i += 4 }
    i++
  }
  return a
}

// Strip non-SGR escapes (cursor moves, title sets, etc.)
const STRIP_RE = /\x1B(?:\[[0-9;]*[A-HJKSTf]|\][^\x07]*(\x07|\x1B\\)|\(.\|[^\x1B])/g
const SGR_RE   = /\x1B\[([0-9;]*)m/g

export function parseAnsi(input: string): AnsiSpan[] {
  const cleaned = input.replace(STRIP_RE, '').replace(/\r/g, '')
  const spans: AnsiSpan[] = []
  let attrs: Attrs = { ...RESET }
  let last = 0

  SGR_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = SGR_RE.exec(cleaned)) !== null) {
    if (m.index > last) spans.push({ text: cleaned.slice(last, m.index), ...attrs })
    attrs = applyCode(attrs, m[1] ? m[1].split(';').map(Number) : [0])
    last = m.index + m[0].length
  }
  if (last < cleaned.length) spans.push({ text: cleaned.slice(last), ...attrs })
  return spans.filter(s => s.text.length > 0)
}

export function spansToStyle(span: AnsiSpan): React.CSSProperties {
  return {
    color:           span.fg ?? undefined,
    background:      span.bg ?? undefined,
    fontWeight:      span.bold ? 'bold' : undefined,
    fontStyle:       span.italic ? 'italic' : undefined,
    textDecoration:  span.underline ? 'underline' : undefined,
    opacity:         span.dim ? 0.6 : undefined,
  }
}
