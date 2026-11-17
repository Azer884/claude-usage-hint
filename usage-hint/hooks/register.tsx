import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { UsageLine } from '../types'
import { newerSnapshot, segmentLimits, usageColor } from './format'
import type { Snapshot } from './format'

const line = atom({ plugin: 'usage-hint', key: 'line' } as const, null as UsageLine)

// Every session redraws on the same wall-clock quarter hours (:00, :15, :30, :45).
const PERIOD_MS = 15 * 60_000
// `$.store` is one file shared by every session on this machine.
const SNAPSHOT_KEY = 'snapshot'

async function sharedSnapshot($: EngineInterface): Promise<Snapshot | null> {
  return ((await $.store.get(SNAPSHOT_KEY)) as Snapshot | undefined) ?? null
}

async function refresh($: EngineInterface, local: Snapshot | null) {
  const snapshot = newerSnapshot(local, await sharedSnapshot($))
  const segments = snapshot ? segmentLimits(snapshot.limits, await $.clock.now()) : []
  await update($, line, () => (segments.length > 0 ? segments : null))
}

export const register: Register = on => {
  // Limits from this session's own API responses, stamped with when they arrived.
  let local: Snapshot | null = null

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const { rateLimits } = await $.session.usage()
    // Age unknown: any snapshot another session shared wins over it.
    if (rateLimits.length > 0) local = { at: 0, limits: rateLimits }
    await refresh($, local)

    const now = await $.clock.now()
    $.clock.after(PERIOD_MS - (now % PERIOD_MS), () => {
      void refresh($, local)
      $.clock.every(PERIOD_MS, () => void refresh($, local))
    })
    return result
  })

  // Share each fresh reading with the other sessions; it is drawn at the next quarter hour.
  on('session.measure', async ($, e, next) => {
    local = { at: await $.clock.now(), limits: e.rateLimits }
    if (newerSnapshot(local, await sharedSnapshot($)) === local) {
      await $.store.set(SNAPSHOT_KEY, local)
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
          <Text color={usageColor(s.pct)}>
            {i > 0 ? ' · ' : ''}
            {s.text}
          </Text>
        ))}
      </Box>
    )
  })
}
