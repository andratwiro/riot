---
name: riot-ui
description: RIOT's concrete design system — tokens, reserved palettes, vote semantics, layout behavior, component idioms, touch rules. Read BEFORE touching the viewer's UI code (markup, styles, or front-end JS), wherever those files live. Pairs with the frontend-design skill (general design quality) and the screenshot skill (visual verification).
---

# RIOT UI system

Hard constraints first: **vanilla HTML/CSS/JS, no framework, no build step, no
npm for the site itself.** Three.js (CDN) exists solely for the Her mark
(`her.js`). One shared viewer serves every city; per-city differences come only
from `cities/<id>/` bundles (config / data / ai_votes). The file layout of the
viewer itself may change — treat AGENTS.md as the source of truth for paths,
and this skill as the source of truth for how the UI must look and behave.

**Every visual change gets verified with the `screenshot` skill before
pushing** — mobile (390×844) first; this is a phone-first app. Bump the
visible version tag on every push (see AGENTS.md).

## Tokens (CSS custom properties)

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0e1014` | page background (near-black, blue-tinted) |
| `--card` | `#1b1f27` | primary surface |
| `--card2` | `#222732` | raised/secondary surface |
| `--line` | `#2b313c` | every border, track, axis |
| `--ink` | `#f0f2f6` | primary text |
| `--dim` | `#9aa1ad` | secondary text, labels, icons |
| `--acc` | `#6db3ff` | interactive accent: links, YOU dot, selection, primary CTA |
| `--for` / `--against` / `--abstain` | `#27b66a` / `#e5485f` / `#9aa1ad` | vote semantics |

Derive new colors from these; don't invent parallel grays/blues. Dark theme
only; body-text shades in use: `#d4d8e0` (brief), `#bcc3cf` (deep). Keep AA
contrast on `--card`.

**Reserved palettes — never repurpose:**
- **Her coral `#d1684e`** + cream ring/lemniscate = the AI proxy's identity,
  and nothing else. The animated mark is `HerOS1.mount()/dispose()` — one
  persistent WebGL instance per slot, static SVG lemniscate fallback when
  WebGL is unavailable, always disposed when its overlay closes.
- **Amber `#f0b46d`** = "AI/editorial provenance" accents: the ✨ reword flag,
  preview tag, analyst-read (lectura) box, original-wording tag. It signals
  reworded or opinionated content, distinct from the neutral blue accent.

## Vote semantics (fixed, non-negotiable)

Against = **left + red**, Abstain = **middle + gray**, For = **right + green**.
Keyboard ← / ↓ / → matches. Card exit animations: right = for, left = against,
down = abstain. Never reorder, recolor, or re-map these.

## Layout behavior

- The app is a fixed, **no-scroll** column: `100dvh`, `max-width:680px`,
  centered. Order: header → affinity bar → map panel → progress → card stack.
- Only designated regions scroll: the survey column on phones, the expanded
  card's reveal, the done screen, full-screen overlays. No page-level scroll.
- Fixed bottom elements pad with `env(safe-area-inset-bottom)`.
- Known debt: the top zone already stacks four chrome layers before the card —
  don't add a fifth; consolidate instead.

## Component idioms (reuse, don't reinvent)

- **Pills** (`border-radius:999px`): presence, topic tags, map bar, badges.
- **Surfaces**: `var(--card)` + `1px solid var(--line)`, radius 12–20px
  (bigger surface = bigger radius); the elevated card stack alone gets the
  deep shadow (`0 18px 50px rgba(0,0,0,.4)`).
- **Section labels**: 10–11px, uppercase, `letter-spacing:.4px`, `--dim`, 700.
- **Full-screen overlays**: `fixed inset:0; background:var(--bg)`, sticky
  header bar with `rgba(14,16,20,.95)` + `backdrop-filter:blur(8px)`,
  centered content wrap. Escape must close them.
- **Bottom sheet** for menus/settings: dimmed backdrop + slide-up panel,
  row items, switch toggles.
- **Chips + colored vote dots** for per-party votes; **badges** for
  outcome/agreement states.
- **Party identity**: white circle + logo via the shared `logoEl()` helper
  (brand-color backfills for square logos, token-on-color fallback). Never
  hand-roll a party avatar.

## Motion & feedback

- Layout/position moves: `cubic-bezier(.2,.7,.3,1)`, 280–550 ms.
- Every tappable element gets `:active{transform:scale(.94–.99)}` press
  feedback (~.08s); tap-highlight is globally disabled.
- The card-advance timing (exit animation ↔ the ~230 ms `react()` timeout)
  must stay in sync if either changes.

## Touch & accessibility rules

- Touch targets ≥ 44 px.
- **No hover-only or tooltip-only affordances** — `title=` is invisible on
  touch. Anything a phone user must understand needs visible text or a
  one-time hint.
- Re-renders rebuild `innerHTML`; persistent WebGL canvases (Her mark) must be
  re-homed after each re-render and `dispose()`d when their container goes.

## Adjacent rules

- UI chrome strings are hardcoded English while content is per-city — when
  touching user-facing strings, route them so a per-city strings table can
  localize them later; don't scatter new literals.
- Card **copy** is governed by `docs/CARD_STYLE.md` (strict, separate).
- The blind-voting firewall applies to UI: pre-vote screens must never leak a
  decision's own outcome, tally, or party positions.
