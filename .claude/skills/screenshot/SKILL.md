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

# Brussels
node .claude/skills/screenshot/shoot.js tour --city brussels

# just the opening screen (quick check after a CSS tweak)
node .claude/skills/screenshot/shoot.js shot
node .claude/skills/screenshot/shoot.js shot --desktop          # 1440×900 too

# options
--city <id>     # reus (default) | brussels
--out <dir>     # default /tmp/riot-shots/<city>
--port <n>      # default 8741 (reuses an already-running server on that port)
```

**Then actually Read the PNGs.** A screenshot you didn't look at proves
nothing. The tour writes, in order: `01-initial`, `02-expanded`,
`03-map-unlocked` (after 5 votes), `04-party-compare`, `05-done-top`,
`06-done-bottom`, `07-sheet`, `08-rawdata`, `09-desktop-initial`.

## App-driving gotchas (learned the hard way)

- **The top (interactive) card is `#stack`'s LAST child** — behind-cards come
  first in DOM order. A bare `.card .btn` selector clicks a hidden card and
  times out. The driver votes via DOM `click()` on `#stack.lastChild`.
- **An expanded card ("See more") hides its vote buttons** and disables the
  arrow-key shortcuts. Collapse with `Escape` before voting.
- The map bar **auto-opens** after `CFG.mapGate` votes (5 by default) and
  reflows the column — wait ~800 ms before screenshotting around the gate.
- Vote transitions take ~230 ms (`react()` advances `idx` on a timeout);
  the driver waits 300 ms between votes.
- Done screen is reached when `#done` has `display:flex`.
- Firebase stubbing = the driver intercepts `firebase-config.js` and serves
  `window.FIREBASE_CONFIG=null` (the app's documented single-player fallback);
  the gstatic SDK requests are aborted. **Never screenshot against the live
  room config** — your phantom participants show up for real visitors.

## Custom flows

For a flow the tour doesn't cover (curator mode, import view, a specific
card), copy `shoot.js` to `/tmp/`, edit the `tour()` function, and run that
copy — don't grow this driver for one-offs. If a new flow becomes a recurring
need, add it here as a named mode.
