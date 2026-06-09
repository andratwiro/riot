---
name: screenshot
description: Serve the RIOT static app locally and screenshot every screen (card stack, expanded card, opinion map, party compare, done screen, options sheet, raw data) with headless Chromium. Use to visually verify any UI change before pushing, or whenever asked to look at the UI.
---

# RIOT screenshot loop

One self-contained driver: it starts its own local server, finds the Playwright
Chromium already cached on this machine, **stubs Firebase** (so headless runs
never join the live multiplayer rooms or inflate the "N here" presence pill),
walks the whole app, and writes numbered PNGs.

## One-time bootstrap (per machine / after reboot)

The driver needs `playwright-core` (the npm package only — the browser itself
is already cached in `~/Library/Caches/ms-playwright`):

```bash
mkdir -p /tmp/riot-pw && cd /tmp/riot-pw && npm init -y && npm i playwright-core
```

If no `chromium-*` browser exists in the ms-playwright cache, install one once
with `cd /tmp/riot-pw && npx playwright install chromium`.

## Usage

```bash
# full tour, mobile viewport (390×844), default city reus → /tmp/riot-shots/reus/
node .claude/skills/screenshot/shoot.js tour

# Brussels, simulated 15-person room, curated live deck
node .claude/skills/screenshot/shoot.js tour --city brussels --params "simroom=15&deck=live"

# the room-session flow: join screen → booth+strip → stamp → split → next card
node .claude/skills/screenshot/shoot.js booth --params "simroom=15&deck=live"

# 60fps check: 5s rAF sampler while 15 sim peers tick (prints avg fps + long frames)
node .claude/skills/screenshot/shoot.js perf --params "simroom=15&deck=live"

# just the opening screen (quick check after a CSS tweak)
node .claude/skills/screenshot/shoot.js shot
node .claude/skills/screenshot/shoot.js shot --desktop          # 1440×900 too

# options
--city <id>     # reus (default) | brussels
--params <qs>   # extra query params, e.g. "simroom=15&deck=live"
--out <dir>     # default /tmp/riot-shots/<city>[-params]
--port <n>      # default 8741 (reuses an already-running server on that port)
```

**Then actually Read the PNGs.** A screenshot you didn't look at proves
nothing. The tour writes: `01-initial`, `02-expanded`, `03-mid-deck`,
`04-reveal-top`, `05-reveal-bottom`, `06-party-compare`, `07-sheet`,
`08-minutes`, `09-desktop-initial`.

## App-driving gotchas (learned the hard way)

- **The top (interactive) card is `#stack`'s LAST child** — behind-cards come
  first in DOM order. A bare `.card .btn` selector clicks a hidden card and
  times out. The driver votes via DOM `click()` on `#stack.lastChild`.
- **Room sessions gate on a join screen** (`#join`): when `simroom` (or a real
  room) is active and no identity is stored, click `#joinGo` first — the
  driver's `passJoin()` handles it.
- **The vote beat**: a vote triggers the stamp (~460ms solo) and, in a room,
  the after-vote split (~2.5s, tap-to-skip). The driver waits 950ms / 2700ms
  per vote accordingly. Votes are blocked while the beat runs (`voting` flag).
- An expanded card keeps its vote buttons (pinned under the scrolling brief);
  `Escape` collapses it.
- Done/reveal is reached when `#done` has `display:flex`; wait ~1.6s after
  for the map-dot entrance animation to land before screenshotting.
- `?simroom=N` fakes an N-person room with no backend (peers tick, tallies
  seed) — use it for presence/split/perf shots; without it (and with Firebase
  stubbed) the app is single-player: no strip, no join, no split.
- Firebase stubbing = the driver intercepts `firebase-config.js` and serves
  `window.FIREBASE_CONFIG=null` (the app's documented single-player fallback);
  the gstatic SDK requests are aborted. **Never screenshot against the live
  room config** — your phantom participants show up for real visitors.

## Custom flows

For a flow the tour doesn't cover (curator mode, import view, a specific
card), copy `shoot.js` to `/tmp/`, edit the `tour()` function, and run that
copy — don't grow this driver for one-offs. If a new flow becomes a recurring
need, add it here as a named mode.
