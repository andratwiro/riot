# RIOT architecture (final state)

Vanilla HTML/CSS/JS. **No framework, no build, no npm for the site.** Only CDN
dep is Google Fonts (Archivo + Courier Prime). One shared viewer serves every
city. AGENTS.md is the source of truth for per-file detail and the data
pipeline; this is the map.

## Load order (classic scripts, one shared global scope)

`index.html` `document.write`s the city bundle, then loads in this fixed order:

```
cities/<id>/config.js  → window.CITY_CONFIG     (copy/chrome)
cities/<id>/data.js    → window.RIOT            (parties + decisions)
app.js → map.js → views.js → multiplayer.js → live.js → roomfloor.js
inline boot (bottom of index.html)
```

Order is load-bearing: later files read globals the earlier ones declare. No ES
modules. Cross-file calls are guarded `typeof fn==="function"` so every richer
layer degrades to a no-op in solo — preserve that pattern for any new seam.

## Files

| File | Role |
|---|---|
| `app.js` | Core: city/state binding, the deck, the card stack (booth), the vote beat, the reveal. Owns the shared mutable state. |
| `map.js` | Reveal-only opinion map. Builds one party×decision matrix, 5 DOM/SVG projections (no WebGL), `layoutMap` declustering pass. |
| `views.js` | Secondary surfaces: minutes/raw log, party-compare, curator marks, votes export/import. |
| `multiplayer.js` | Async rooms: presence + anonymous aggregate tallies (no lockstep). |
| `live.js` | Live sittings: lockstep moderator-driven state machine, lobby/reveal/stage. The largest file. |
| `roomfloor.js` | The footer crowd (live only): a small physics sim, `window.RF`. |
| `firebase-config.js` | RTDB creds; `null` ⇒ single-player fallback. |

## State

Global mutable module vars, by design — no store. The live ballot is `answers`
(plain `{id:dir}`); position is `deck`/`idx`/`voting`. **Votes are memory-only**
(die on reload — deliberate). localStorage holds only curator marks + dev flag;
identity is per-tab sessionStorage.

- **`resetSession()` (app.js) is the single writer** for "wipe ballot + re-deal a
  fresh full session." `#restart` and the async-room reset route through it. The
  live seat gate and import clear `answers` their own way (they don't re-deal).
- Re-rendering is full `innerHTML` rebuilds + one delegated listener on `#stack`.
  The active card is `#stack`'s **last** child (stack builds back-to-front).
- `applyGhostParty()` splices the GHOST/BLANK into `PARTIES` + `party_votes_canon`
  in place (on/off symmetry); rebuilds map coords.

## Seams

- **`window.LIVE`** and **`window.RF`** are clean public surfaces; `app.js` only
  touches live/floor through them.
- The reverse direction is looser: map/live/multiplayer reach into app.js globals
  (`answers`, `deck`, `PARTIES`, `byId`) directly. `live.js`↔`multiplayer.js` are
  co-dependent (live reaches into `mpPart`/`PEERS`/Firebase refs).

## The body-class state machine

Rendering branches on body classes, set by JS:

- **`body.live`** — umbrella: any live role/phase (set once at `liveInit`, never
  removed). Phase classes layer on top: `live-voter` (persists), `live-lobby`,
  `live-mod`, `live-paused`, `live-final` (re-shows ⚙), `live-floor`, `can-wave`.
- `body.in-room` — async room. `body.solo-cover` — solo entrance. `body.dev`.
- `html.hold`/`html.lvhold`/`html.reveal`/`html.cover` — set pre-paint to avoid
  shell-flash.

The sets are **not cleanly nested** (`live-voter` persists across phases;
`live-final` is an exception). Use `body.live` only where a rule applies to all
live phases (e.g. the masthead full-name); keep phase-specific rules explicit.

## Multi-city

A city = `cities/<id>/{config,data}.js` exporting two globals. Contract is
**convention, not enforced** — `?city` allowlist is a comment in index.html.
`validateBundle()` (app.js, opt-in via `?debug=1`, console-only) checks: every
party token appears in some vote, every `demo_deck`/`live_deck` id is a real
decision, required config keys present.

Data pipeline (`scripts/*.py`): real cities fetch→extract per-member→aggregate→
emit `data.js`; demo cities hand-author `data/<id>/cards.json` + an assembly
script. See AGENTS.md for per-city detail.

## Firebase (RTDB)

`rooms/<city>/live/current` → active `sessions/<sid>` (`state/deck/idx/deadline/
cfg`). Voters write `tallies/<id>/<dir>` (anonymous increments) and `cast/<id>/
<pid>` (pseudonymous direction, revealed only post-card). Async rooms use a
parallel `rooms/<city>/{participants,control,tallies,cov}` tree.
"Server-authoritative" = only the moderator client writes session state (a
convention); the booth firewall is enforced client-side + RTDB rules.
