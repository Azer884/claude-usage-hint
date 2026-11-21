# Changelog

## 0.4.0 - 2026-11-21

- Fixed: after a usage reset, other open terminals kept the old numbers. A session no longer stamps an old reading as new when only its context or cost moved, so it cannot overwrite the fresh reading another session shared. An empty reading is never shared.
- Each session checks the shared reading every minute and redraws as soon as a newer one arrives, so a reset reaches every terminal within a minute.
- A session draws its own new reading at once instead of waiting for the quarter hour.

## 0.3.0 - 2026-11-17

- Open sessions on the same machine share the newest reading through the mod's store and redraw together on the quarter hour.

## 0.2.0 - 2026-11-17

- The usage line is redrawn every 15 minutes instead of every 30 seconds and after each API response.
- Added README, license, and changelog.

## 0.1.0 - 2026-10-11

- First version: 5h and 7d usage with time to reset, colored by usage, beside the prompt hint.
