export type UsageLine = readonly { text: string; pct: number }[] | null

declare module 'claude-code' {
  interface PluginState {
    'usage-hint': { line: UsageLine }
  }
}
