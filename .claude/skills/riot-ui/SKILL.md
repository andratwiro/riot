---
name: riot-ui
description: RIOT's concrete design system («l'acta» ballot-paper theme) — tokens, reserved palettes, the booth doctrine (activity not direction; no valence pre-vote), layout behavior, component idioms, touch rules. Read BEFORE touching the viewer's UI code (markup, styles, or front-end JS), wherever those files live. Pairs with the frontend-design skill (general design quality) and the screenshot skill (visual verification).
---

# RIOT UI system — «l'acta»

Hard constraints first: **vanilla HTML/CSS/JS, no framework, no build step, no
npm for the site itself.** Google Fonts (CDN) provides Archivo + Courier Prime;
there is no other runtime dependency. One shared
viewer serves every city; per-city differences come only from `cities/<id>/`
bundles. Treat AGENTS.md as the source of truth for file paths; this skill is
the source of truth for how the UI must look and behave.

**Every visual change gets verified with the `screenshot` skill before
pushing** — mobile (390×844) first; this is a phone-first app. Bump the
visible version tag on every push (see AGENTS.md).

## The aesthetic

The chrome is the world of ballots and minutes: paper, print-ink, the violet
of an official stamp pad, typewritten numbers. Saturated color is reserved
for **data** — party brand colors — and never decorates chrome. The signature
element is **the stamp**: casting a vote thunks a violet imprint onto the card.

## Tokens (CSS custom properties)

| Token | Value | Role |
|---|---|---|
| `--paper` | `#F2F0E8` | page background (ballot stock) |
| `--card` | `#FBFAF6` | the ballot card |
| `--card2` | `#ECE9DF` | inset surfaces (raw minutes text, pressed) |
| `--rule` | `#D9D5C8` | every border, form rule, track |
| `--ink` | `#1C1B17` | print black: text, buttons, tally bars |
| `--ink80` | `#3F3C33` | body text |
| `--ink60` | `#6C685D` | secondary print, labels, meta |
| `--stamp` | `#4B3FA0` | stamp-pad violet — the ONE chrome accent: stamp imprint, focus, links, YOU, presence pulse, room tick |
| `--moss` / `--brick` | `#3E6B4F` / `#9C3D3D` | valence — **post-vote contexts only** (splits, reveal badges, minutes) |
| `--amber` | `#8A6A1F` | editorial provenance: ✨ AI-reword flag, lectura box, preview tag |

Type roles: `--f-ui` = **Archivo** (statements 650, buttons 700, body 400) —
the official-archive grotesque; `--f-mono` = **Courier Prime** — every number,
count, label, eyebrow, and verbatim quote wears the typewritten face of the
minutes. No other families. (A serif lobby display face was tried 2026-06-12
and rolled back same day — Rob: use what the app uses.)

**Reserved palettes — never repurpose:** party hexes appear only as data
(logo discs, affinity fills, map dots). **The GHOST** (the AI that predicts
its keeper) deliberately owns NO colour: it wears `--ghost-ink` (an alias of
`--stamp` — the YOU violet) as the "soul anchor" mark — a dashed shell + solid
core SVG, ONE source of truth (`ghostMark(size)` in app.js, ~8–10 dashes at
every size — Rob: dashes sparse, never a blur), no fill inside the ring, no
opacity tricks, never a disc — but always PARTY size (34px list slot, 30px
map dot): spectral dress, first-class seat. In running UI rows the name is
"Ghost" in the same face as party names (Rob, 2026-06-11); GHOST uppercase
mono lives in the stamp and the token chips. Verb doctrine: parties "vote
with you" (representation), the ghost "predicts you" (fidelity) — same number
format, never homogenized. The GHOST stamp (`.gstamp`, FOR/APPROVED
construction in ghost ink) is large-surface decoration only — never at list
or map scale. On the map: seated = visible, every projection, NO toggle; the
You view carries its one caption line; in fan-outs the dashed shell is
displaced while the solid core holds the true coordinate (it IS the ghost's
anchor). **The BLANK** (Rob, 2026-06-12 — the no-soul control: the same model
voting the same neutral context with no profile) wears the SAME branding minus
the soul: the dashed shell with **no core dot** (`ghostMark(size,{noCore:true})`),
same ghost ink, party size, row name "Blank", BLANK stamp in its compare view.
It seats and clears WITH the ghost (one switch, `applyGhostParty`) and follows
every ghost rule (excluded from the headline finding, never lands mid-deck or
on the piles); in map fan-outs it gets the plain anchor ring at its true point —
never a re-inked core, it has no soul to ink. Party-disc backfills (`bg-<token>`)
must be sampled from the logo asset itself — a near-miss yellow reads as a
dirty ring (CUP, fixed #ffdd00).

## The booth doctrine (non-negotiable)

- During voting the app broadcasts **ACTIVITY, never DIRECTION**: no party
  data, no affinity, no map anywhere in the voting flow. The map and the
  parties belong to the reveal.
- **No valence color pre-vote.** Vote buttons are ink-on-paper: Against (left)
  and For (right) are *exactly equal* in weight; Abstain (middle) is quieter.
  Moss/brick exist only after the user's own vote is cast.
- The after-vote room split renders only AFTER the user's vote is in the
  tally (it cannot bias a cast ballot); counts only, never who. Roomless
  passes (solo / async) get the chamber's per-card reveal in the same slot
  instead (Rob, 2026-06-11): the official stamp + party discs on the
  Against/Abstain/For piles — post-vote per decision, so the firewall holds.
  The GHOST never lands there: mid-deck its prediction would bias its keeper;
  it belongs to the final reveal only.
- Vote semantics are fixed: Against = left, Abstain = middle, For = right;
  keyboard ← / ↓ / →; card exits left / down / right. Never reorder.
- The shared layer stores directions as anonymous aggregate tallies
  (`rooms/<room>/tallies/<id>/<dir>`, atomic increments). Async-room
  participant records carry counts and timestamps, never votes. LIVE sessions
  (amended by Rob, 2026-06) additionally write each voter's direction to their
  cast marker — pseudonymous by join emoji, surfaced ONLY on reveal surfaces
  (the per-card reveal's piles + each participant's row placement on the
  final reveal's map), never while a ballot is open.

## Layout behavior

- Fixed, no-scroll column, `100dvh`, `max-width:680px`: header → room strip →
  progress row → card stack. The strip and progress are the ONLY chrome
  between header and card — don't add more.
- Scroll regions: survey column on phones, expanded card's `.reveal`
  (vote buttons stay pinned below it — reading the brief is the
  highest-intent voting moment), full-screen overlays. **The reveal screen
  scrolls as THE PAGE** (Rob, 2026-06): `doneVis()` tags `html.reveal`,
  which releases the body's `overflow:hidden` page lock and drops `#done`
  out of its absolute overlay into flow — wheel/touch anywhere (including
  outside the 680px column on desktop) scrolls the results, and header +
  strip scroll away with the page. Hiding the reveal restores the lock and
  `scrollTo(0,0)`; never show/hide `#done` except through `doneVis()`.
- Fixed bottom elements pad with `env(safe-area-inset-bottom)`.
- `hidden` attribute + a CSS `display` rule conflict: any element styled
  `display:flex|grid` needs an explicit `[hidden]{display:none}` override.

## Component idioms (reuse, don't reinvent)

- **The stamp** (`.stamp`): violet double-ring imprint, mono 800, −8°,
  `mix-blend-mode:multiply`, ~200ms thunk. One per vote. Stamps land in
  `.stamprow` — a right-aligned **zero-height** in-flow row just above the
  action slot (via `stampRow(card)`); stamps grow upward from it and may
  overlap the card content above — that's the effect: ink hits the page, the
  page doesn't move. **The card must never change size when a stamp lands.**
  Still never absolutely positioned (history: an absolute stamp shrink-fit
  against its offsets), and the zero-height trick needs `align-content:
  flex-end` or the wrapped flex line drops BELOW the row onto the buttons.
  The stage overrides back to `height:auto` (no card to hold still there).
  (More history: the APPROVED variant once carried a bare `app` class that
  collided with `.app{height:100dvh}` — viewport-tall stamps. Class names on
  injected elements must never reuse root/layout class names.)
- **Room strip**: overlapping 28px faces (emoji or mono initials, me =
  violet ring, max 7 + `+N`), activity ring ticks (`facetick`, compositor
  only — transform/opacity), mono label `N here` — presence only, no
  percentages (the room's average progress shows solely as the progress
  bar's violet tick; a number that needs explaining dies).
- **Progress row**: 3px rule + ink fill + 2px violet room-average tick +
  mono `n / total`.
- **Split panel** (`.split`): mono uppercase kicker, three label/track/count
  rows in button order (Against/Abstain/For), ink fills, my row violet with
  `←`; "tap to continue" hint.
- **Section labels**: mono 10–11px uppercase letterspaced `--ink60`.
- **Surfaces**: `--card` + 1px `--rule`, radius 8–12px; only the card stack
  gets the elevated shadow.
- **Full-screen overlays**: `fixed inset:0; background:var(--paper)` + sticky
  blurred header; Escape closes; ✕ closes (one idiom — not ⚙, not ←,
  except the party view's back-arrow which returns to the reveal).
- **Party identity**: white disc + logo via `logoEl()` (brand backfills for
  square logos); never hand-roll an avatar.
- **Solo cover** (`#solo`/`.sl-*`, app.js `soloEnter`): `?solo=1` opens on the
  record's first page, not in the booth — kicker / big Archivo 800 title /
  lore paragraphs / mono meta line / one ink CTA, all from `CFG.solo_lobby`
  (`{n}` = deck length; absent config = the plain cover: name + count). Same
  skeleton as the live lobby so it reads as the same room, with two deliberate
  differences: the eyebrow is STATIC stamp-violet mono (never a pulsing chip —
  nothing is live; the history decks are memorials), and the lore wears body
  ink (`--ink80`, max 54ch) not the lobby's muted grey — solo is the one
  entrance where the visitor came to READ. `body.solo-cover` hides
  #survey/#roomstrip AND the §/⚙ header buttons until the CTA deals the deck
  (the sheet and minutes belong to the booth). The cover must never leak a
  card's own outcome; the era's arc is lore, a single division's result is not.
- **Join screen (the seat gate)**: kicker (violet mono) → Archivo 800 headline
  → 4×4 emoji grid (≥44px targets, one preselected — the tab's own face when
  it has one) → optional mono name field → single ink CTA (live sittings:
  `CFG.lobby.cta`, the seat metaphor in the city's own language — Reus "Ocupa
  el teu seient", fallback "Take your seat"; sim rooms: "Enter the booth").
  One screen, one button, <30s. **The CTA tap IS the join**: nothing about
  the tab exists for the room (presence, counts, faces) until it's tapped,
  and every new sitting re-asks — one tap back in. The shared voter URL leads
  STRAIGHT here whatever the sitting's state (Rob, 2026-06-12: the gate must
  trigger on the URL itself — a lobby-first variant was tried and rolled back
  same day; un-seated watchers are invisible to each other, so the gathering
  read as broken). A voter URL with no sitting behind it shows the holding
  page, not the booth.
- **Live-session idioms** (`live.js` + the `LIVE SESSION` block in style.css):
  the **voter lobby is the seated waiting room, glanceable** (Rob,
  2026-06-12: nobody reads; its only jobs are "something is about to happen /
  people are arriving / wait for it"; the shared URL gates FIRST — see the
  join screen above) — the app's OWN header on top (left-aligned brand,
  exactly as everywhere; no bespoke letterhead), hero (`.lb-hero`, vertically
  centred: pulsing live chip in stamp violet ~1.6s opacity cycle with the dot
  and the mono caps on one visual centre — `line-height:1` on the chip; huge
  Archivo 800 title; a single muted one-liner whose `{count}` is the live
  deck's length), presence (`.lb-presence`, bottom: overlapping 38px faces
  capped at 8 + `+N` chip, newcomers scale in via `.lb-pop`, big mono count
  with `aria-live="polite"` counting peers + me — the room is never empty to
  the person standing in it). Session metadata folds into the tiny
  `.lb-about` disclosure; the methodology pitch is GONE from the lobby — only
  the privacy line renders on the FIRST vote card (`LIVE.cardNotes` →
  `.acts-priv` micro-type below the vote buttons, dead after the first cast;
  a blind-vote rule line above the buttons was tried and cut by Rob,
  2026-06-12 — the blind mechanic explains itself when the reveal lands). ALL lobby copy comes from
  `CFG.lobby` (per-city; no copy conditionals in live.js), never hardcoded.
  On open the screen falls away and one line of the minutes remains — the
  chair's formula (`CFG.lobby.sittingOpenedFormula`, ~1.6s, voters who
  witnessed the gathering only) — then the first card lands;
  the **countdown** is one ink bar closing from both edges toward the centre
  (`scaleX`, origin centre; stamp-violet under 5s) — a ceiling, not a clock;
  **ballot cast** shows a mono `n/m` count, never the split; the per-card
  reveal is two beats, **verdict first**: beat 1 the **official stamp**
  (`.stamp.official`, classes `st-app`/`st-rej`) — the chamber's imprint, moss
  APPROVED / brick REJECTED, +4° (opposite the user's −8°), small chamber
  eyebrow (`CFG.chamber`), and under the verdict word the **margin subtitle**
  (`.st-m`, lowercase mono): winner-first head-count, `· N abstained` only
  when nonzero, per-chamber pairs on bicameral decks, the word "unanimous"
  when the acta records no count (unanimous actas ship an all-zero `tally` —
  never print a fabricated 0–0), NO subtitle when tally data is missing
  entirely (never guess) — lands in the same `.stamprow` next to the
  user's stamp; the final reveal's room-v-chamber badges carry the same
  margin format on BOTH sides (room from `LIVE.tally`) — parallel facts;
  beat 2 (+900ms) the **room rains in as emoji piles** (`.piles`,
  `renderLivePiles`): every cast face drops onto its pile in button order
  (Against/Abstain/For), abstain quieter, my column violet, counts under the
  rules, timeouts one muted "n didn't vote" line — no bars. **The chamber
  lands on the same piles** (Rob, 2026-06, always on): each party's
  `party_votes_canon` direction drops its `logoEl` disc in a `.pl-chamber`
  row beneath the faces — the room above, the institution under it; absent
  tokens (single-chamber measures, the GHOST) don't land; the `.pl-n` count
  stays room ballots only. Per-decision party positions are reveal-surface
  data — affinity/map detail is still the final reveal's. Pile directions
  come from cast markers (see
  doctrine); the **stage** (`#stage`) scales with `clamp()` for 5-metre
  legibility and reuses the piles enlarged. Voter chrome in live mode is
  stripped (no §, no ⚙ until the final reveal, city switch disabled).

## Motion & feedback

- Layout moves: `cubic-bezier(.2,.7,.3,1)`, 280–550ms. Press: `:active`
  scale .92–.99. Card-advance timing: exit animation ↔ the ~260ms timeout in
  `react()` stay in sync.
- **Map positions are data** (`layoutMap` in map.js — runs after every map
  render/morph/peer update + resize): never silently displace a dot. Tied or
  heavily-occluding party+YOU discs fan on a tight ring around their true
  point — anchor ring AT the true point (violet when YOU shares it: that
  co-location is the headline fact, never buried) + a 1px hairline from each
  displaced disc to its OWN true coordinate, so near-ties stay exact. Every
  dot (peers too) clamps fully inside the panel (pad ≥ its radius); a true
  point beyond the edge gets a flat bar pressed against that border. New dot
  kinds must carry `data-tx/ty` (true, unclamped %) or the pass skips them.
- The reveal map is the payoff: dots stagger in via `--d` animation-delay
  (parties ~90ms apart, YOU last). YOU = the user's join emoji in a paper disc
  with a violet ring + a "you" paper pill below (`.mc.you`/`.mtag`; falls back
  to the violet YOU disc with no identity). Peers are small faded emojis below
  the party dots' z-index (anonymous ink ring when faceless) — the crowd is
  texture, the parties are the anchors.
- Animations are transform/opacity only (the 15-peer pulse must hold 60fps —
  verified via the screenshot skill's `perf` mode; keep it ≥58fps, 0 long
  frames).
- `prefers-reduced-motion: reduce` collapses ALL animation/transition
  durations (blanket rule at the end of style.css) — keep end-states valid
  without motion (`both` fill).

## Touch & accessibility rules

- Touch targets ≥ 44px. `:focus-visible` = 2px violet outline (global rule).
- **No hover-only or tooltip-only affordances** — `title=` is invisible on
  touch; anything a phone user must understand needs visible text.
- Re-renders rebuild `innerHTML`; persistent WebGL canvases re-home after
  re-render and `dispose()` when their container goes. The room strip is the
  exception: faces rebuild only on membership change; ticks toggle classes.

## Adjacent rules

- UI chrome strings are hardcoded English while content is per-city — route
  new user-facing strings so a per-city strings table can localize later.
- Card **copy** is governed by `docs/CARD_STYLE.md` (strict, separate).
- The blind-voting firewall applies to UI: pre-vote screens must never leak a
  decision's own outcome, tally, or party positions.
- Destructive room-wide actions (reset everyone) live behind curator mode +
  a two-step in-place confirm; never one tap.
