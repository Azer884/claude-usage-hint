import type { SessionRateLimit } from 'claude-code'

const LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d' }
const WINDOW_MS: Record<string, number> = { five_hour: 5 * 3600_000, seven_day: 7 * 86400_000 }

// Past its reset a window is back to 0% with a fresh countdown: roll the reset
// forward by whole window lengths until it lies ahead.
export function rolled(kind: string, pct: number, resetsAt: string | undefined, now: number) {
  const reset = resetsAt ? Date.parse(resetsAt) : NaN
  const size = WINDOW_MS[kind]
  if (Number.isNaN(reset) || reset > now || !size) return { pct, resetsAt }
  const next = reset + Math.ceil((now - reset + 1) / size) * size
  return { pct: 0, resetsAt: new Date(next).toISOString() }
}

// Compact duration: "3d4h", "2h14m", "9m", "now".
export function remaining(resetsAt: string | undefined, now: number): string | null {
  if (!resetsAt) return null
  const ms = Date.parse(resetsAt) - now
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return 'now'
  const minutes = Math.floor(ms / 60000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return `${days}d${hours}h`
  if (hours > 0) return `${hours}h${mins}m`
  return `${mins}m`
}

// "5h 23% 2h14m · 7d 41% 3d4h", or null when no window has a reading.
export function formatLimits(limits: readonly SessionRateLimit[], now: number): string | null {
  const parts = ['five_hour', 'seven_day'].flatMap(kind => {
    const limit = limits.find(l => l.kind === kind)
    if (!limit) return []
    const left = remaining(limit.resetsAt, now)
    const pct = `${Math.round(limit.percentUsed)}%`
    return [`${LABELS[kind]} ${pct}${left ? ` ${left}` : ''}`]
  })
  return parts.length > 0 ? parts.join(' · ') : null
}

export type UsageSegment = { text: string; pct: number }

// A reading of the limits and when it arrived (ms since the epoch).
export type Snapshot = { at: number; limits: readonly SessionRateLimit[] }

// Whether a `session.measure` carries a fresh reading worth sharing. A measure
// also fires when only the context or cost moved; its `rateLimits` are then
// the last response's, maybe from before a reset another session already saw.
// Stamping those as new would overwrite the newer shared reading.
export function isFreshReading(changed: readonly string[], limits: readonly SessionRateLimit[]): boolean {
  return limits.length > 0 && changed.includes('rateLimits')
}

// The later of two readings; `a` on a tie.
export function newerSnapshot(a: Snapshot | null, b: Snapshot | null): Snapshot | null {
  if (!a) return b
  if (!b) return a
  return b.at > a.at ? b : a
}

// One segment per window so each can be colored by its own percentage.
export function segmentLimits(limits: readonly SessionRateLimit[], now: number): UsageSegment[] {
  return ['five_hour', 'seven_day'].flatMap(kind => {
    const limit = limits.find(l => l.kind === kind)
    if (!limit) return []
    const cur = rolled(kind, limit.percentUsed, limit.resetsAt, now)
    const left = remaining(cur.resetsAt, now)
    return [{ text: `${LABELS[kind]} ${Math.round(cur.pct)}%${left ? ` ${left}` : ''}`, pct: cur.pct }]
  })
}

// Light gray at 0%, shading through orange to pure red at 100%.
export function usageColor(pct: number): string {
  const t = Math.min(1, Math.max(0, pct / 100))
  const mix = (a: number, b: number, k: number) => Math.round(a + (b - a) * k)
  const [r, g, b] =
    t < 0.5
      ? [mix(190, 255, t * 2), mix(190, 170, t * 2), mix(190, 60, t * 2)]
      : [255, mix(170, 30, (t - 0.5) * 2), mix(60, 30, (t - 0.5) * 2)]
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}
