import { expect, test } from 'claude-code/testing'

import { formatLimits, isFreshReading, newerSnapshot, remaining, segmentLimits, usageColor } from './format'

const now = Date.parse('2026-10-11T12:00:00Z')

test('formats both windows with time to reset', () => {
  const text = formatLimits(
    [
      { kind: 'five_hour', percentUsed: 23.4, resetsAt: '2026-10-11T14:14:00Z' },
      { kind: 'seven_day', percentUsed: 41, resetsAt: '2026-10-14T16:30:00Z' },
    ],
    now,
  )
  expect(text).toBe('5h 23% 2h14m · 7d 41% 3d4h')
})

test('null when no window has a reading', () => {
  expect(formatLimits([], now)).toBe(null)
})

test('remaining handles past and missing resets', () => {
  expect(remaining('2026-10-11T11:00:00Z', now)).toBe('now')
  expect(remaining(undefined, now)).toBe(null)
  expect(remaining('2026-10-11T12:09:59Z', now)).toBe('9m')
})

test('usageColor runs gray to red', () => {
  expect(usageColor(0)).toBe('#bebebe')
  expect(usageColor(100)).toBe('#ff1e1e')
})

test('segmentLimits resets to 0% and restarts countdown after reset', () => {
  const seg = segmentLimits([{ kind: 'five_hour', percentUsed: 97, resetsAt: '2026-10-11T11:00:00Z' }], now)[0]!
  expect(seg.pct).toBe(0)
  expect(seg.text).toBe('5h 0% 4h0m')
})

test('newerSnapshot keeps the later reading', () => {
  const old = { at: 1, limits: [] }
  const fresh = { at: 2, limits: [] }
  expect(newerSnapshot(old, fresh)).toBe(fresh)
  expect(newerSnapshot(fresh, old)).toBe(fresh)
  expect(newerSnapshot(null, old)).toBe(old)
  expect(newerSnapshot(old, null)).toBe(old)
  expect(newerSnapshot(null, null)).toBe(null)
})

test('isFreshReading only takes measures where the limits moved', () => {
  const limits = [{ kind: 'five_hour', percentUsed: 3, resetsAt: '2026-10-11T16:00:00Z' }]
  expect(isFreshReading(['rateLimits', 'cost'], limits)).toBe(true)
  // Only cost or context moved: the limits are the last response's, maybe stale.
  expect(isFreshReading(['cost'], limits)).toBe(false)
  expect(isFreshReading(['context'], limits)).toBe(false)
  // No reading at all must never overwrite the shared one.
  expect(isFreshReading(['rateLimits'], [])).toBe(false)
})
