---
name: riot-ui
description: RIOT's concrete design system («l'acta» ballot-paper theme) — tokens, reserved palettes, the booth doctrine (activity not direction; no valence pre-vote), layout behavior, component idioms, touch rules. Read BEFORE touching the viewer's UI code (markup, styles, or front-end JS), wherever those files live. Pairs with the frontend-design skill (general design quality) and the screenshot skill (visual verification).
---

# RIOT UI system — «l'acta»

Hard constraints first: **vanilla HTML/CSS/JS, no framework, no build step, no
npm for the site itself.** Three.js (CDN) exists solely for the Her mark
(`her.js`); Google Fonts (CDN) provides Archivo + Courier Prime. One shared
viewer serves every city; per-city differences come only from `cities/<id>/`
bundles. Treat AGENTS.md as the source of truth for file paths; this skill is
the source of truth for how the UI must look and behave.

**Every visual change gets verified with the `screenshot` skill before
pushing** — mobile (390×844) first; this is a phone-first app. Bump the
visible version tag on every push (see AGENTS.md).

## The aesthetic

The chrome is the world of ballots and minutes: paper, print-ink, the violet
of an official stamp pad, typewritten numbers. Saturated color is reserved
for **data** — party brand colors and the Her-coral AI mark — and never
decorates chrome. The signature element is **the stamp**: casting a vote
thunks a violet imprint onto the card.

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
minutes. No other families.

**Reserved palettes — never repurpose:** Her coral `#d1684e` (+ cream
ring/lemniscate) is the AI proxy and nothing else (`HerOS1.mount/dispose`,
SVG fallback, dispose on overlay close). Party hexes appear only as data
(logo discs, affinity fills, map dots).

## The booth doctrine (non-negotiable)

- During voting the app broadcasts **ACTIVITY, never DIRECTION**: no party
  data, no affinity, no map anywhere in the voting flow. The map and the
  parties belong to the reveal.
- **No valence color pre-vote.** Vote buttons are ink-on-paper: Against (left)
  and For (right) are *exactly equal* in weight; Abstain (middle) is quieter.
  Moss/brick exist only after the user's own vote is cast.
- The after-vote room split renders only AFTER the user's vote is in the
  tally (it cannot bias a cast ballot); counts only, never who.
- Vote semantics are fixed: Against = left, Abstain = middle, For = right;
  keyboard ← / ↓ / →; card exits left / down / right. Never reorder.
- The shared layer stores directions ONLY as anonymous aggregate tallies
  (`rooms/<room>/tallies/<id>/<dir>`, atomic increments). Participant records
  carry counts and timestamps, never votes.

## Layout behavior

- Fixed, no-scroll column, `100dvh`, `max-width:680px`: header → room strip →
  progress row → card stack. The strip and progress are the ONLY chrome
  between header and card — don't add more.
- Scroll regions: survey column on phones, expanded card's `.reveal`
  (vote buttons stay pinned below it — reading the brief is the
  highest-intent voting moment), the reveal screen, full-screen overlays.
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
  only — transform/opacity), mono label `N here · room X%`.
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
- **Join screen**: kicker (violet mono) → Archivo 800 headline → 4×4 emoji
  grid (≥44px targets, one preselected) → optional mono name field → single
  ink CTA. One screen, one button, <30s.
- **Live-session idioms** (`live.js` + the `LIVE SESSION` block in style.css):
  the **countdown** is one ink bar closing from both edges toward the centre
  (`scaleX`, origin centre; stamp-violet under 5s) — a ceiling, not a clock;
  **ballot cast** shows a mono `n/m` count, never the split; the **official
  stamp** (`.stamp.official`, classes `st-app`/`st-rej`) is the chamber's
  imprint — moss APPROVED / brick REJECTED, +4° (opposite the user's −8°),
  small chamber eyebrow (`CFG.chamber`) — landing in the same `.stamprow` next
  to the user's stamp as reveal beat 2, after the room's split (beat 1); the
  **reveal split is two layers per row** — thick ink bar = this room, thin
  outlined bar = the chamber by group/party (`.sp-bars`/`.sp-ns`, legend
  `.sp-leg`), each normalised to its own total; the **stage** (`#stage`)
  scales with `clamp()` for 5-metre legibility and reuses the split rows
  enlarged. Voter chrome in live mode is stripped (no §, no ⚙ until the final
  reveal, city switch disabled).

## Motion & feedback

- Layout moves: `cubic-bezier(.2,.7,.3,1)`, 280–550ms. Press: `:active`
  scale .92–.99. Card-advance timing: exit animation ↔ the ~260ms timeout in
  `react()` stay in sync.
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
