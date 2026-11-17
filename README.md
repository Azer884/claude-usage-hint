# usage-hint

A Claude Code mod that shows your rate-limit usage right beside the prompt hint, so you can see how much of your 5-hour and 7-day windows you have used and when each one resets.

```
auto mode on  5h 23% 2h14m · 7d 41% 3d4h
```

Each window is colored by its own usage: light gray at 0%, shading through orange to red at 100%.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install usage-hint --marketplace Azer884/claude-usage-hint
```

Answer `y` to add the marketplace, then press Enter to pick the user scope. The mod is active right away, with no restart.

From a shell:

```
claude plugin install usage-hint --marketplace Azer884/claude-usage-hint
```

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `Azer884/claude-usage-hint`, then **Add plugin**.

## What it shows

| Part | Meaning |
| --- | --- |
| `5h` / `7d` | The 5-hour and 7-day rate-limit windows |
| `23%` | How much of that window you have used |
| `2h14m` | Time until that window resets (`3d4h`, `2h14m`, `9m`, or `now`) |

- A window with no reading is left out. If neither window has a reading, the hint line is drawn as normal.
- Once a window's reset time has passed, it shows `0%` with a fresh countdown until the next reading arrives.

## How often it updates

- The line is drawn once when a session starts.
- After that it is redrawn **every 15 minutes, on the quarter hour** (:00, :15, :30, :45).
- Each API response records the latest limits, but the line only shows them at the next redraw. Percentages and countdowns can be up to 15 minutes old.

### Sync across terminals

Every Claude Code session on the same machine shares one reading. When any session gets an API response, it saves the limits to the mod's store (a JSON file under your Claude Code config directory). At each quarter hour, every open session draws the newest saved reading, so all terminals show the same numbers at the same time.

A newly opened session shows the newest saved reading straight away, before it has made any request of its own.

To change the interval, edit `PERIOD_MS` in [`usage-hint/hooks/register.tsx`](usage-hint/hooks/register.tsx).

## Repository layout

```
.claude-plugin/marketplace.json   Marketplace file that lists the mod
usage-hint/
  .claude-plugin/plugin.json      Mod manifest
  hooks/hooks.json                Points to the hooks module
  hooks/register.tsx              Hooks: session start, API responses, hint line drawing
  hooks/format.ts                 Pure formatting: labels, countdown, rollover, colors
  hooks/format.test.ts            Tests for format.ts
  types/index.d.ts                State contract for the mod
  tsconfig.json                   Type-check config
```

## Development

Run the mod from this folder without installing it:

```
claude --plugin-dir ./usage-hint
```

Validate the manifest and hooks module:

```
claude plugin validate ./usage-hint
```

Run the tests:

```
claude plugin test ./usage-hint
```

To type-check, load the mod once so the engine writes its types to `usage-hint/.claude-plugin/types/`, then run:

```
tsc -p ./usage-hint
```

## Uninstall

```
/plugin uninstall usage-hint
```

## License

[MIT](LICENSE)
