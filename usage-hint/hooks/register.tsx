import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { UsageLine } from '../types'
import { segmentLimits, usageColor } from './format'

const line = atom({ plugin: 'usage-hint', key: 'line' } as const, null as UsageLine)

async function refresh($: EngineInterface, limits: readonly SessionRateLimit[]) {
  const segments = segmentLimits(limits, await $.clock.now())
  await update($, line, () => (segments.length > 0 ? segments : null))
}

export const register: Register = on => {
  let limits: readonly SessionRateLimit[] = []

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    limits = (await $.session.usage()).rateLimits
    await refresh($, limits)
    // Redraw the line once every 15 minutes from the latest known limits.
    $.clock.every(15 * 60_000, () => void refresh($, limits))
    return result
  })

  on('session.measure', async ($, e, next) => {
    limits = e.rateLimits
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
