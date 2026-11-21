import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { UsageLine } from '../types'
import { isFreshReading, newerSnapshot, segmentLimits, usageColor } from './format'
import type { Snapshot } from './format'

const line = atom({ plugin: 'usage-hint', key: 'line' } as const, null as UsageLine)

// Every session redraws on the same wall-clock quarter hours (:00, :15, :30, :45).
const PERIOD_MS = 15 * 60_000
// How often each session checks the shared store for a newer reading, so a
// reset seen by one terminal reaches the others within a minute.
const SYNC_MS = 60_000
// `$.store` is one file shared by every session on this machine.
const SNAPSHOT_KEY = 'snapshot'

async function sharedSnapshot($: EngineInterface): Promise<Snapshot | null> {
  return ((await $.store.get(SNAPSHOT_KEY)) as Snapshot | undefined) ?? null
}

// Draws the newest reading; answers its `at` so callers can tell when it moved.
async function refresh($: EngineInterface, local: Snapshot | null): Promise<number> {
  const snapshot = newerSnapshot(local, await sharedSnapshot($))
  const segments = snapshot ? segmentLimits(snapshot.limits, await $.clock.now()) : []
  await update($, line, () => (segments.length > 0 ? segments : null))
  return snapshot?.at ?? -1
}

// Limits from this session's own API responses, stamped with when they arrived.
let local: Snapshot | null = null
// `at` of the reading last drawn.
let drawnAt = -1

async function redraw($: EngineInterface) {
  drawnAt = await refresh($, local)
}

// Redraws only when another session shared a reading newer than the one drawn.
async function syncShared($: EngineInterface) {
  const shared = await sharedSnapshot($)
  if (shared && shared.at > drawnAt) await redraw($)
}

export const register: Register = on => {
  local = null
  drawnAt = -1

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const { rateLimits } = await $.session.usage()
    // Age unknown: any snapshot another session shared wins over it.
    if (rateLimits.length > 0) local = { at: 0, limits: rateLimits }
    await redraw($)

    const now = await $.clock.now()
    $.clock.after(PERIOD_MS - (now % PERIOD_MS), () => {
      void redraw($)
      $.clock.every(PERIOD_MS, () => void redraw($))
    })
    // Between quarter hours, redraw only when another session shared a newer reading.
    $.clock.every(SYNC_MS, () => void syncShared($))
    return result
  })

  // Share each fresh reading with the other sessions and draw it here at once;
  // the others pick it up at their next store check.
  on('session.measure', async ($, e, next) => {
    if (isFreshReading(e.changed, e.rateLimits)) {
      local = { at: await $.clock.now(), limits: e.rateLimits }
      if (newerSnapshot(local, await sharedSnapshot($)) === local) {
        await $.store.set(SNAPSHOT_KEY, local)
      }
      await redraw($)
    }
    return next(e)
  })

  // Drawn on the hint line beside "auto mode on". `tail` only draws dim, so
  // the line is redrawn as a tree: the engine's hint dim, then each window
  // colored by its own usage.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const segments = await read($, line)
    if (!segments) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text dimColor>{`${e.props.hint}  `}</Text>
        {segments.map((s, i) => (
          <Text key={String(i)} color={usageColor(s.pct)}>
            {i > 0 ? ' · ' : ''}
            {s.text}
          </Text>
        ))}
      </Box>
    )
  })
}
