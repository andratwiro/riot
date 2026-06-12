# AGENTS.md — RIOT

> Orientation file for AI agents (and humans) working in this repo. Read this
> first; it should be enough to act without reading every file. For the full
> rationale and non-negotiables, see [`Riot.md`](Riot.md).

## What this is

**RIOT** asks a falsifiable question: *can an AI ghost faithfully represent a
citizen's political will on real council decisions?* The engine is
jurisdiction-agnostic and now runs **three instances** behind one shared viewer:

- **Reus** (`?city=reus`, the default) — the original proof. Rob votes manually on
  contested Reus city-council decisions (stored device-locally). The **GHOST** — the AI trained on him — votes
  **blind** — from a private profile (`soul.md`, gitignored) plus each decision's
  *neutral* context, never from Rob's votes, the parties' votes, or the outcome.
  Parties contribute their real recorded votes. We compare Rob vs each party vs
  the AI, and report the AI's **out-of-sample hit-rate** against Rob's votes.
- **Brussels** (`?city=brussels`) — the Brussels-Capital regional Parliament,
  built for the Go Vocal demo. Real 2024–26 roll-call (nominal) votes parsed from
  the plenary CRIs, aggregated to political groups; English card copy over French
  source text.
- **Congress** (`?city=congress`) — DEMO-grade US instance: 16 landmark roll-call
  votes of the 117th–119th Congresses (TikTok, marriage, abortion (rejected), guns,
  infrastructure, IRA, debt ceiling, Ukraine, Laken Riley, OBBBA, ICC sanctions
  (rejected), campus antisemitism, Iran + Venezuela war powers (both rejected),
  the 43-day-shutdown ender, the PBS/NPR defund), hand-authored from the official
  record (clerk.house.gov / senate.gov / congress.gov) — no Python pipeline yet.
  Parties are the **four floor caucuses** (House/Senate × Dem/GOP), so the map
  shows chamber splits (e.g. Ukraine aid: Senate GOP for, House GOP against);
  single-chamber measures (campus antisemitism = House only, Iran war powers =
  Senate only) carry only the caucuses that actually voted — the viewer treats
  absent tokens as "didn't vote comparably". Source of truth + per-card audit
  trail (roll numbers, tallies, caucus breakdowns): `data/congress/cards.json`.

It is a **static site** (`index.html` + per-city `cities/<id>/` bundles) on GitHub
Pages, fed by **Python data pipelines** (`scripts/`). **No backend, no build step,
no package manager.** Optional Firebase Realtime Database powers shared
multiplayer rooms (presence + live dots) — the site still works single-player
without it.

🔗 Live: https://andratwiro.github.io/riot/

## Repo map

| Path | What it is |
|------|------------|
| `index.html` | The shared viewer's markup + loaders: a `?city=reus\|brussels\|congress` loader picks which `cities/<id>/` bundle to load (only data + config differ per city), then the app scripts below, then a small inline **boot** block (startup order: `applyGhostParty` → `mpInit` → `liveInit` → `renderStack`). The **bare URL (no query string) is not an entrance**: a tiny inline `<head>` script tags `html.hold` BEFORE first paint (CSS swaps shell↔holding on frame one — the end-of-body boot runs far too late to prevent a header flash while CDN scripts load; the same script tags `html.lvhold` on EVERY voter boot with a query string, holding clean paper until `live.js` resolves the URL to seat gate / silent re-seat / the wall — see `live.js`; the single-player fallback retires it at boot) and it shows a zero-info holding page (`#holding`: just the "RIOT" wordmark with an occasional chromatic-split glitch — rose echo left, blue echo right (a deliberate, user-directed exception to the chrome-accent palette, holding page only), static under reduced motion) and skips the whole boot — no `mpInit`, so parked tabs never appear in room presence. Carries the visible **version tag** (see Conventions). |
| `deliberate.html` | **Standalone design demo, no app logic** — "the floor": the open debate between parties, rebuilt for the people, on two real Brussels decisions (MP pay −5% / Budget 2026), full-viewport. The deliberation is the product; the decision is a compact sticky fixture (desktop: rail · floor · pinned "Reading the room" synthesis; mobile: pinned header → synthesis → floor). **Direction is visible by default everywhere** (a deliberate, user-directed exception to the booth doctrine — the room's shape IS the message; this page only, never the booth): every statement carries its split bar on first paint, mass scales type/bar weight, and one scrollable floor is banded structurally — Common ground (cross-camp agreement, the actionable findings) / The fault line (camp cross-tabs, the nuance engine) / Still forming (recency-protected fresh voices + composer). The pay view opens on **the opinion map** — parties v. the people in ONE projected space (canvas density + 1,500 sampled residents; party glyphs ink-on-halo; 4 labeled opinion clusters with shares; tap a cluster → its defining statements light below, tap a party → its inferred stance pins on every bar; a "representation gap" readout — 65% closer to no party than to any party). Map data is PRECOMPUTED by `scripts/build_floor_map.py` (stdlib PCA over a simulated 21k-resident room; party stances illustrative, labeled) → `deliberate-data.js`; the page projects only the USER through the shipped components. Budget view: official −957 v. the floor's −1,006 draft as the headline gap, a **squarified treemap** (hand-rolled; area = M€; debt = locked black tile; lean carried by ▲/▼ glyphs, never color) with an official↔floor toggle that animates the people redrawing the budget, cut/keep/grow per envelope (response counts thin down the list), debt as the immovable slab, a diverging "where the axe falls" chart. Presence rendered as mass (count tick, responses/h, fresh-responses pulse). Vocabulary lock: ballots (headline) · responses (statements/envelopes) · statements (the slips). Desktop left rail carries the full proposal + provenance block. Self-contained: links `style.css` for tokens/idioms, scoped styles + local JS, precomputed data at 20k-scale (illustrative, labeled), localStorage for the user's own positions only ("where am I in this room?" answerable on every surface once they participate), no Firebase. |
| `style.css` | All viewer CSS — the «l'acta» ballot-paper theme (tokens + doctrine in `.claude/skills/riot-ui/SKILL.md`). |
| `app.js` | Viewer core: city config/state, the booth (card stack, stamp + after-vote split beat, deck modes incl. `?deck=live`; roomless passes — solo/async, no tally — swap the split for the **chamber's per-card reveal** inherited from live sittings: `stampOutcome` (live.js) + `chamberPiles`/`renderChamberInto` land the official stamp and each party's disc on the Against/Abstain/For piles, ~2.6s tap-to-skip, post-vote per decision so the firewall holds; the GHOST never lands mid-deck — it would bias its keeper), **the solo entrance** (`?solo=1`, Rob's self-experiment rig: the booth alone — full deck, no `mpInit`/`liveInit`, no presence, no `lvhold`; pairs with ⧉ Copy votes / Import votes for the multi-session 100-decision ballot; `&ai=1` seats the GHOST on the solo reveal via the same `applyGhostParty` the moderator switch uses — solo only, a sitting's ghost mode stays the moderator's; `ghostMark(size)` here is the ONE source of the GHOST's dashed-shell + solid-core SVG mark, inked in `--ghost-ink`), the reveal screen, the **seat gate** (`gateShow`/`gateGo` — the emoji screen whose CTA is the JOIN: presence is published only from the tap; `live.js` re-shows it per sitting with the tab's face preselected, CTA "Take your seat"; the boot-time `maybeShowJoin` gates only the backendless `?simroom` rig), city switcher. Votes live in memory only. **Identity is per-TAB** (sessionStorage, like `mpPid`): every new browser session/window re-prompts the gate — the room never remembers who you were (the legacy localStorage copy is purged at load). Your chosen face renders top-right as the **me-badge** (`#meBadge`, `updateMeBadge()`, the `.face.me` idiom) — your own "account" mark, hidden on the lobby letterhead and moderator chrome. |
| `map.js` | The affinity map (reveal-only): everyone who voted — the parties, YOU, and every ballot this device knows (live cast markers, sim peers) — as rows of **ONE matrix** over the deck's decisions (`matrixRows`; Polis-style, no party-skeleton + out-of-sample patching). **Five projections**, picked from the `#mapProj` chip row — chips wear plain what-you-get names, the method's real name lives only in the note's trailing "(technically: …)" tag (copy doctrine on the `PROJECTIONS` registry: 12-year-old at a glance, max two short sentences, no stats vocabulary): **`Room`** (default; PCA — axes from party rows + the room's anonymous covariance aggregate, see Conventions; a ballot is scored over its ANSWERED columns only and scaled by `sqrt(m/answered)` — the Polis sparsity correction, without which a partial ballot shrinks to the centre), **`Gaps`** (SMACOF metric MDS over all rows — the distance-faithful view), **`You`** (egocentric: you at the centre, every dot at its exact vote-distance from you, bearings from Gaps — the You-view frame includes YOU), **`Quiet votes`** (correspondence analysis — abstain is its own category, not a midpoint), and **`Camps`** (t-SNE; gated: offered only at ≥30 rows — a crowd view, meaningless below that). Each chip carries its own note AND map caption (`cap` — "closer = more alike" is only claimed where true). All layouts are Procrustes-aligned by their PARTY rows onto a party-only classical-MDS baseline (`partyBaseline`) so switching morphs structure, not spin. A known ballot's spot is its row coordinate — `blendCoord(votes, key)` looks it up by `"me"` or a peer's pid; `getProj` revalidates a row fingerprint so late ballots re-enter the solve (the shared Jacobi eigensolver's rotation sign was fixed here — it silently failed to converge on clustered spectra). Presence publishes a CANONICAL position (`publishCoord`: always the Room frame — parties + shared aggregate, identical on every device), independent of the local pick; outside live, a peer sits where it published. **Rendering honesty (`layoutMap`)**: positions are data — after every render/morph/peer update (and on resize) one pixel-space pass over the live DOM fans heavily-occluding party/YOU discs on a tight ring around their shared spot (anchor ring at the TRUE point — violet when YOU shares it, the headline fact — plus a 1px hairline from each displaced disc to its OWN true coordinate, so near-ties stay exact) and clamps every dot, peers included, fully inside the panel (pad ≥ its radius; a true point beyond the band gets a flat bar pressed against that border — reads "at or beyond the edge", never a fake position). `toPct` is now raw/unclamped (the layout pass owns clamping); only `publishCoord` still ships the legacy clamped 2–98 wire form. **The GHOST on the map:** one more matrix row, rendered as the bare dashed-shell+solid-core mark (`ghostMark`, app.js) at party-dot size — seated (moderator cfg / solo `&ai=1`) means ON the map, every projection, no toggle (Rob, 2026-06-11). In a fan-out the SHELL is displaced and the core is re-inked at the TRUE coordinate (`.split` hides the in-dot core; `.mlay .gcore` draws it) — the core is the ghost's anchor. The You view adds the ghost caption line (`GHOST_CAP`). |
| `views.js` | Secondary views: the minutes (raw-data log, one tap via the header `§`; a page-wide provenance pill toggles every title between the AI-reworded headline and the source's own wording), party comparison, **curator mode** (moderator-only: `?role=moderator` reveals a Curator switch on the Minutes page — review checks on each row + marks-JSON download; a persisted dev flag never activates on a plain voter URL), votes export/import (⧉ Copy votes lives on the final screen AND in the options sheet — mid-deck snapshots are the point; importing a COMPLETE set lands on the reveal, a PARTIAL one resumes the booth on the remaining cards — the multi-session ballot; ↻ re-deals and discards the import), options sheet. |
| `multiplayer.js` | The room (Firebase Realtime DB): presence with names/emoji, anonymous per-decision tallies, the joint-map second-moment aggregate (`rooms/<room>/cov`, contributed once at reveal via `mpContributeCov`, read back into `jointDataChanged`), room progress, activity ticks, curator room reset; single-player fallback; `?simroom=N` fakes a room for testing (sim peers carry a fabricated ballot that drives both their map dot and the aggregate). **Presence is seat-gated** (Rob, 2026-06): a participant record is written only by `mpJoin()` — the seat gate's tap or a same-sid refresh — never on page load, and it carries the sitting it joined (`s: <sid>`); `mpLeave()` withdraws it when the sitting moves on without the tab. Every count and face goes through `mpVisiblePids()` (live: only records with `s === LIVE.sid()`; sim rigs pass through) — a record orphaned by yesterday's sitting or a never-tapped tab is structurally invisible, so stale records can't inflate the lobby or block the all-in auto-advance. **Burst coalescing (big rooms):** presence- and cov-driven map work is trailing-throttled at 300ms (`throttleTrail` in app.js — `mapNudge` here, `jointResolve` in map.js) so the final reveal's finisher burst triggers a few re-solves, not one per event; in live sittings a vote publishes only an `{n,ts}` presence update (placement comes from cast markers — the full record shape stays the join's). |
| `live.js` | **LIVE SESSION** — lockstep room voting (lobby → per-card voting/reveal → final reveal; everyone on the same card). State machine in `rooms/<city>/live` (RTDB), written ONLY by the moderator client (`?role=moderator`, whose screen doubles as the projector/stage view). Voters write an anonymous tally increment + a `cast` marker carrying their direction (reveal-only; see Conventions); countdown renders from a server-clock deadline (`.info/serverTimeOffset`); timeouts are recorded nowhere and so are auto-excluded from affinity. Per-card reveal: the chamber's official stamp first — carrying the real margin as a `.st-m` subtitle (`marginPair`/`chamberMargin`: winner-first head-count from `d.tally`, `· N abstained` only when nonzero; the bicameral Congress deck ships `tally_house`/`tally_senate` and renders both chamber pairs; unanimous actas ship an all-zero `tally` ⇒ the subtitle says "unanimous", never a fabricated 0–0; no tally data at all ⇒ verdict alone, never a guess) — then the room as emoji piles WITH the chamber on them (Rob, 2026-06, always on): each party's `party_votes_canon` direction drops its `logoEl` disc in a `.pl-chamber` row beneath the faces; absent tokens (single-chamber measures, the GHOST) don't land, and the pile count stays room ballots only — affinity/map detail stays in the final reveal/minutes. The final reveal's room-v-chamber rows carry the same margin format on BOTH badges (room side from `LIVE.tally`) so they read as parallel facts. The voter lobby is **the seated waiting room, glanceable** (Rob, 2026-06-12: nobody reads — its only jobs are "something is about to happen / people are arriving / wait for it"; the shared URL gates FIRST): the app's own header (left-aligned, as everywhere), hero (pulsing live chip ~1.6s, huge Archivo 800 title, one-liner whose `{count}` is the live deck's length), presence (overlapping faces capped at 8 + `+N` chip, newcomers scale in, big mono count with `aria-live="polite"` counting peers + me — never "0 in the room" to the person standing in it). All copy from `CFG.lobby`; session metadata folds into the small `lb-about` disclosure; the old intro paragraph is gone and the blind-vote rule + privacy line moved to the FIRST vote card (`LIVE.cardNotes` → `.acts-rule`/`.acts-priv`, rendered by app.js around the vote buttons, dead after the first cast). On open the screen falls away to the chair's formula (`sittingOpenedFormula`, ~1.6s) before the first card lands. **Seats (Rob, 2026-06): the voter URL is the sitting's entrance and nothing else.** A voter boot holds clean paper (`html.lvhold`, every voter URL) until the store answers `current`: no sitting ⇒ **the wall** (`lvWall` — the holding page, reversible: a sitting created later turns it back into the gate); a sitting whose sid matches the tab's `riot.sid.v1` ⇒ silent re-seat (`mpJoin`, no gate — a pull-to-refresh doesn't eject anyone); anything else ⇒ the **seat gate** (`showSeatGate` → app.js `gateShow(true)`, face preselected, button label from `CFG.lobby.cta` — Reus "Ocupa el teu seient"; Rob, 2026-06-12: the gate triggers on the shared URL itself, whatever the sitting's state — a lobby-first variant was rolled back same day, un-seated watchers can't see each other so the gathering read as broken). The TAP is the join (`LIVE.seat`): it stores the sid, clears local `answers` (a stale ballot from an earlier sitting would block voting and fake "in flight" casts), publishes presence stamped `s:<sid>`, and lands the tab wherever the sitting is — lobby, the live card, or the final reveal (dotless there: no cast markers). `voterCount`/lobby faces/stage faces/`checkAllIn` all see only this sitting's records (`mpVisiblePids`), so stale tabs neither inflate the room nor stall the auto-advance; ending a sitting walls every non-final tab (`liveEnded` → `mpLeave`), a NEW sid re-gates everyone (one tap back in), and the solo booth is unreachable on a backend — only `?simroom`/stubbed-Firebase dev runs still get it, plus the one deliberate exception: `?solo=1` (see app.js) skips live resolution and the room entirely. **Lobby refresh hold:** while seated in the lobby, a sessionStorage flag (`riot.liveLobby` = city id) re-paints the CFG-prefilled lobby on frame one while Firebase reconnects. **Synthetic voters:** `cfg.bots` (moderator setup option, "synthetic voters", 0–24) seats N fake people in the room to stage how a fuller session looks — real participant records + random tally/cast writes from the moderator's client (presence via `PEERS` in sim rooms / `mpPart` on Firebase; casts via `lvStore` either way), so every phone renders them exactly like humans: lobby faces, ballots-in counts, reveal piles. Human-ish timing (spread + deadline cluster + the odd timeout), deterministic pids (`bot<i>`) so a reloaded moderator re-adopts them, `onDisconnect` + session end remove them. **Ghost mode:** `cfg.ai` (moderator setup switch, "GHOST" — shown only when the city ships `AI_VOTES`; the wire key predates the name) seats the GHOST as one more row in the reveal for the WHOLE room: every client mirrors the session flag on each snapshot (`liveSyncGhost` → `applyGhostParty`), a voter parked on the final screen keeps it, and back-to-booth resets it — the old per-visitor ⚙ toggle is gone (its `riot.ai.v1` key is purged at load). **The stage join moment:** the lobby stage shows a scannable QR (`qrSVG` — inline ink SVG via the vendored `assets/qrcode.min.js`) above the join URL, and that URL ALWAYS carries `?city=<id>` — even for Reus — because the bare URL is the holding page, not an entrance. Voters arrive over presence, not session writes, so the `renderStrip` wrapper also re-renders the moderator's stage while the state is `lobby` (without it the gathering faces never refresh — nothing touches the session node until the sitting opens). |
| `cities/<id>/config.js` | Per-city chrome + tunables: `window.CITY_CONFIG` (name, logo, document `lang`, source-document `srcLang` for the original-wording toggle, `chamber` for live-session copy, `lobby` — ALL live-lobby strings: live_chip / title / body_name / one_liner (`{count}`/`{body}`) / count_line / cta / about_label / docketInstitutionLine / docketCountLine (`{period}`/`{n}` computed from the active deck) / disclosure / sittingOpenedFormula, plus firstCardRule + privacyLine which render on the FIRST vote card, not the lobby; Reus is the Catalan reference, Brussels/Congress wording carries TODO(rob) markers, `mapGate`). |
| `cities/<id>/data.js` | `window.RIOT = {...}` — that city's decisions table as a JS object (avoids CORS). **Generated** by `build_table.py` (Reus) / `build_table_bxl.py` (Brussels). |
| `cities/<id>/ai_votes.js` | `window.AI_VOTES = {...}` — the GHOST's votes (Reus only so far). |
| `firebase-config.js` | `window.FIREBASE_CONFIG` — multiplayer backend config. Set to `null` for single-player. The apiKey is not a secret; access is governed by the DB rules. |
| `scripts/` | The Python pipelines, Reus + `*_bxl.py` Brussels (see Commands). |
| `data/decisions.json` | **The Reus core table** — top-level metadata + `decisions[]` (one row per decision). The committed source of truth. |
| `data/ai_votes.json` | GHOST votes (mirror of `cities/reus/ai_votes.js`). |
| `data/curator_marks.json`, `data/auto_discretion.json` | Human curator flags + auto-detected low-discretion proposals (Reus). |
| `data/actas/*.txt` | Reus source plenary minutes (PDF → `pdftotext`). |
| `data/raw/` | Reus pipeline intermediates + session index (`sessions.json`). **Audit trail — never delete.** Live inputs to `build_table.py`: `parsed_*.json` (facts) + `explained_*.json` (the human layer — headline/body/brief/deep_facts/deep_lectura all live HERE). The `voice_*`, `deep_*`, `lectura_*` files and `vote_outcomes.json` are superseded intermediates from earlier authoring phases — read by nothing current, kept as history; don't extend them. |
| `data/expedients/` | Reus source PDFs + per-decision metadata (re-fetchable). |
| `data/brussels/` | The Brussels layer: `cri_txt/` (committed CRI text; `cri_pdf/` is gitignored, re-fetchable), `votes_raw.json` (per-MEMBER roll-calls), `roster.json` (member → political group), `cards.json` (English card copy keyed by decision id — **the authored source of truth**; the per-agent `cards_parts/` fragments were merged in and removed 2026-06, edit `cards.json` directly), `decisions_skeleton.json` (**build output** of `build_table_bxl.py` — the committed-JSON mirror of the decisions, Brussels' analogue of `data/decisions.json`; regenerated every build, never hand-edit). |
| `data/congress/cards.json` | The Congress demo's source of truth: the 16 hand-authored cards WITH their `verification` audit blocks (official roll numbers, tallies, caucus breakdowns, package-vote impurity notes — e.g. TikTok/Ukraine Senate directions come from the bundled H.R. 815 vote). Each card also carries structured `tally_house`/`tally_senate` head-counts of the same decisive roll calls (these DO ship — they feed the reveal's margin subtitles; S4132 House = companion H.R. 3755, its Senate = the cloture vote, HR7521/HR8035 Senate = the bundled H.R. 815 package vote, HCONRES64 Senate = the analog S.J.Res. 90; single-chamber cards ship one labelled count). `cities/congress/data.js` is generated from it with `verification` stripped by `scripts/build_table_us.py` (assembly only — no extraction pipeline yet). |
| `assets/logos/` | Party/group logos + brand assets. The three city marks (`reus_rose_color`, `brussels_iris`, `us_capitol`) double as per-city favicons: app.js swaps the head's `#favicon` link to `CFG.logo` and sets `document.title = CFG.title` ("Reus Council" / "Brussels Parliament" / "US Congress") when a city boots. |
| `assets/favicon.svg` | Default tab icon — the GHOST soul-anchor mark on a paper tile (hardcoded `#4B3FA0`/`#F2F0E8`; a favicon can't read CSS vars). Shown on the bare-URL holding page; city boots replace it per the row above. |
| `assets/qrcode.min.js` | Vendored QR encoder (qrcode-generator 1.4.4, MIT) — the stage lobby's join QR (`qrSVG` in `live.js` draws it as inline ink SVG). |
| `docs/` | Canonical working docs — see "Where to read more". |
| `.claude/skills/` | Agent skills: `screenshot/` (self-contained headless-Chromium driver — serves the app, stubs Firebase so test runs never join the live rooms, screenshots every screen; **use it to verify any UI change**), `riot-ui/` (the project's concrete design system: tokens, reserved palettes, vote semantics, idioms), `frontend-design/` (Anthropic's general design-quality skill, vendored). |
| `Riot.md`, `To Do Riot.md` | Vision/non-negotiables + phased build plan. |
| `soul.md` | The GHOST's private profile. **Gitignored, never committed.** |

## Commands

No `package.json`, no `requirements.txt`, no tests. Pipelines are run manually
with Python 3. External deps: the `anthropic` SDK (for `ai_vote.py`) and the
`pdftotext` binary (poppler).

### Reus

```bash
# Phase 0 — enumerate Ple sessions, download + verify each acta PDF → data/actas/*.txt
python3 scripts/fetch_sessions.py

# Corpus survey — regex pass over actas to find/quantify vote outcomes
python3 scripts/extract_votes.py

# Build the committed table — merge data/raw/parsed_<code>.json (per-session,
# facts-only LLM extraction) → data/decisions.json AND cities/reus/data.js
python3 scripts/build_table.py

# Phase 4 — the GHOST. Reads soul.md + each decision's neutral context → blind vote.
# Needs ANTHROPIC_API_KEY in env and soul.md present. Writes cities/reus/ai_votes.js.
python3 scripts/ai_vote.py [--only-missing | --ids <id...> | --limit N | --dry-run]

# Curator gate — auto-flag low-discretion items (proposes drops; never disposes)
python3 scripts/detect_discretion.py
```

### Brussels

```bash
# Download the plenary CRIs (bilingual FR/NL PDFs from weblex) → data/brussels/cri_txt/
python3 scripts/fetch_sessions_bxl.py

# Parse "DÉTAIL DU VOTE NOMINATIF" annexes → data/brussels/votes_raw.json (per MEMBER)
python3 scripts/extract_votes_bxl.py

# Aggregate members → groups via roster.json, merge cards.json → cities/brussels/data.js
# + data/brussels/decisions_skeleton.json. An unmapped voter is FATAL (fix roster.json);
# also prints a per-group bloc-consistency report.
python3 scripts/build_table_bxl.py
```

`scripts/taxonomy.py` is a library, not a CLI: the **canonical legal-category
taxonomy** and votability gate, imported by the Reus extraction/build steps.
(`enrich_tax_cards.py`, `rewrite_headlines.py` are domain-specific copy helpers.)

**Deploy = push to `main`** — GitHub Pages serves the repo directly. After any
change to `data/raw/` re-run `build_table.py`; after any change to
`data/brussels/` re-run `build_table_bxl.py` — the committed JSON and the
city `data.js` must stay in sync.

## Data model

`data/decisions.json` (Reus) is `{ generated_for, note, parties[], sessions_in_table[],
n_decisions, n_explained, decisions[] }`. Each row in `decisions[]`:

- **Identity / source:** `id`, `point`, `title`, `organ`, `session_code`, `date`,
  `source_url`, `acta_url`
- **Classification:** `legal_category`, `type`, `proposed_by`, `topic`, `stake`
- **Outcome (facts):** `outcome`, `decided`, `tally`, `raw_outcome`,
  `party_votes`, `party_votes_canon`, `councillor_votes`, `votes_pending`
- **Human layer (reviewed copy):** `headline`, `human_body`, `source_brief`,
  `explained`
- **Two-layer deep context (critical — see below):** `deep_facts`, `deep_lectura`
- **Curation flags:** `contested_suggested`, `curator_drop`, `auto_suggest`

`parties[]` carries `{ token, name, color, logo }` (Reus: PSC, JxR, ERC, CUP,
VOX, PP; Brussels: the 13 political groups). Brussels emits the **same
`window.RIOT` schema** the viewer expects — card copy lives in
`data/brussels/cards.json` and is merged at build time; cards carry a
`curator_drop`-style active flag so the deck can be curated without deleting
rows. AI votes live separately in `ai_votes.json` / `cities/<id>/ai_votes.js`
(`{ model, produced_via, soul_hash, n_votes, note, votes }`), not inside the
decisions table.

## Architecture & non-negotiables

- **Blind voting.** The GHOST's only inputs are `soul.md` + a decision's
  *neutral, citizen-visible* context. It must never see Rob's votes, party votes,
  or the outcome. Preserve this firewall in any code touching `ai_vote.py`.
- **Card copy is governed by [`docs/CARD_STYLE.md`](docs/CARD_STYLE.md) — strict.**
  Any agent writing or editing card copy (headlines, briefs, deep layers) must
  read it first. The two recurring failure modes: jargon headlines (ETS,
  ordinance numbers, article references) and **own-vote leaks** — a card's own
  result, tally, party list, or "unanimous" tell appearing anywhere in its copy
  or deep layers, which un-blinds the user before they vote.
- **Two-layer separation.** `deep_facts` = neutral, the GHOST's *only* deep
  input. `deep_lectura` = analyst opinion/inference, **human-facing only, never
  an AI input.** Do not blur them. (`build_table.py` enforces this: an
  `explained_*.json` entry carrying the pre-split legacy `deep` field fails the
  build.)
- **`taxonomy.py` is the single source of truth** for what a Reus Ple item legally
  is and therefore whether it is a votable decision. Don't fork that logic.
- **Falsifiability first.** Every decision links back to its source acta/CRI; no
  magic numbers, no hidden steps. The out-of-sample hit-rate is the deliverable.
- **`data/raw/` and `data/brussels/cri_txt/` are audit trails** — additive,
  never deleted.
- **Static site, push-to-deploy.** No backend, no CORS, no in-browser LLM calls;
  the AI votes are produced offline and committed. Firebase is the one optional
  external service (rooms only), and the app must degrade to single-player when
  `FIREBASE_CONFIG` is null.
- **Multiplayer identity is per-tab** (`sessionStorage`), so multiple windows on
  one browser are distinct participants.
- **Async rooms never carry direction.** Shared-layer vote data there is
  anonymous aggregate tallies only (`rooms/<room>/tallies/...`). LIVE sessions
  (doctrine amended by Rob, 2026-06) also keep anonymous tallies
  (`.../sessions/<sid>/tallies/...`), but `cast/<id>/<pid>` markers carry the
  voter's DIRECTION — pseudonymous by join emoji, surfaced only in the
  per-card reveal's emoji piles, never while a ballot is open. Only the
  moderator client writes live-session state.
- **The joint room map's aggregate stays anonymous too.** The `Room`
  projection (`map.js`) places parties and participants as rows of one matrix
  and takes its first two PCs; the room contributes to those axes through a
  summed second-moment accumulator (`rooms/<room>/cov` = `k` / `s/<j>` /
  `m2/<j>_<l>`, atomic increments, written once per finisher in
  `mpContributeCov`), NOT individual ballots — the same anonymous-aggregate
  posture as the tallies. Parties are added as rows locally on every client, so
  an empty room is a clean party PCA and fills toward the room's shape.

## Conventions

- **Frontend:** vanilla HTML/CSS/JS, no framework, no build step;
  Archivo + Courier Prime via Google Fonts (CDN); CSS custom
  properties for theming. The viewer JS is split into plain (non-module) scripts
  that share top-level globals — **load order matters** and is encoded in
  `index.html`: `app.js` → `map.js` → `views.js` → `multiplayer.js` → inline
  boot. Don't convert to ES modules: the city loader relies on
  parser-synchronous `document.write`. (`live.js` loads after `multiplayer.js`;
  the boot block calls `liveInit()` after `mpInit()`.) Parallel agents should
  each own one of these files; shared CSS lives in `style.css`. Before touching viewer UI, read
  `.claude/skills/riot-ui/SKILL.md` (design system + **booth doctrine**:
  activity-not-direction, no valence pre-vote); after, verify visually with
  `.claude/skills/screenshot/` (mobile viewport first).
- **Viewer URL params:** `?city=reus|brussels` (instance), `?deck=live`
  (curated room-session deck from `CFG.live_deck`), `?split=0` (kill the
  after-vote room split), `?simroom=N` (fake N-person room, testing only),
  `?role=moderator` (live-session moderator + stage view; the session picker
  pins the city's curated `CFG.demo_deck` as "DEMO" when defined),
  `?simlive=N[&simtimer=S]` (fake lockstep live session, testing only).
- **Pipeline:** Python 3, stdlib + `anthropic`; module + function docstrings;
  snake_case. JS uses kebab/camelCase.
- **Version tag:** `index.html` carries a visible `vX.YZ` tag in the header
  (currently in the `.ver` span). **Bump it ~+0.01 on every push** and mention
  the new version in the commit message. **On every bump, check whether this
  file (AGENTS.md) is still accurate** — if the change added/moved/renamed
  anything described here (paths, scripts, commands, conventions), update it
  in the same commit.
  - **HOLD AT v0.99 (maintainer rule):** the tag is currently pinned at
    `v0.99`. Do **not** auto-bump past it — keep it at `v0.99` on every push
    until the maintainer explicitly says to switch to `v1.0`. The +0.01-per-push
    rule above is suspended until then. (You should still mention what changed
    in the commit message; just leave the version number alone.)
- **No linters or formatters configured; no automated tests.** Validation is
  manual: cross-check the tables against the source actas/CRIs (the Brussels
  build prints its own roster/bloc-consistency report), curator review of copy
  before merge, and the AI hit-rate as the real metric.
- **Commits** are descriptive (verb + object), live-deploy style.

## Privacy

`soul.md` (the GHOST's profile, and its `soul.*.md` variants) and Rob's own votes
are **never committed** — the repo is public, the private inputs are not. Rob's
manual votes live only in browser `localStorage`. Never add either to the repo.

## Where to read more

| Doc | Read it for |
|-----|-------------|
| [`Riot.md`](Riot.md) | Vision, the bet, goals, non-negotiables, what's out of scope |
| [`To Do Riot.md`](To%20Do%20Riot.md) | The phased build plan (phases 0–7) |
| [`docs/FINDINGS.md`](docs/FINDINGS.md) | Data sources, Reus council composition, extraction method/status, legal taxonomy |
| [`docs/DEEP_DIVE.md`](docs/DEEP_DIVE.md) | The per-item analysis pipeline (neutral facts → opinion layers) |
| [`docs/CARD_STYLE.md`](docs/CARD_STYLE.md) | Canonical copy rules for decision cards (strict — read before touching card copy) |
| [`README.md`](README.md) | Public-facing project intro |
