# AGENTS.md — RIOT

> Orientation file for AI agents (and humans) working in this repo. Read this
> first; it should be enough to act without reading every file. For the full
> rationale and non-negotiables, see [`Riot.md`](Riot.md).

## What this is

**RIOT** asks a falsifiable question: *can an AI proxy faithfully represent a
citizen's political will on real council decisions?* The engine is
jurisdiction-agnostic and now runs **two city instances** behind one shared viewer:

- **Reus** (`?city=reus`, the default) — the original proof. Rob votes manually on
  contested Reus city-council decisions (stored device-locally). An AI proxy votes
  **blind** — from a private profile (`soul.md`, gitignored) plus each decision's
  *neutral* context, never from Rob's votes, the parties' votes, or the outcome.
  Parties contribute their real recorded votes. We compare Rob vs each party vs
  the AI, and report the AI's **out-of-sample hit-rate** against Rob's votes.
- **Brussels** (`?city=brussels`) — the Brussels-Capital regional Parliament,
  built for the Go Vocal demo. Real 2024–26 roll-call (nominal) votes parsed from
  the plenary CRIs, aggregated to political groups; English card copy over French
  source text.

It is a **static site** (`index.html` + per-city `cities/<id>/` bundles) on GitHub
Pages, fed by **Python data pipelines** (`scripts/`). **No backend, no build step,
no package manager.** Optional Firebase Realtime Database powers shared
multiplayer rooms (presence + live dots) — the site still works single-player
without it.

🔗 Live: https://andratwiro.github.io/riot/

## Repo map

| Path | What it is |
|------|------------|
| `index.html` | The shared viewer's markup + loaders: a `?city=reus\|brussels` loader picks which `cities/<id>/` bundle to load (only data + config differ per city), then the app scripts below, then a small inline **boot** block (startup order: `applyAiParty` → `mpInit` → `liveInit` → `renderStack`). The **bare URL (no query string) is not an entrance**: a tiny inline `<head>` script tags `html.hold` BEFORE first paint (CSS swaps shell↔holding on frame one — the end-of-body boot runs far too late to prevent a header flash while CDN scripts load; the same script tags `html.lvhold` to re-seat a refreshed live-lobby tab — see `live.js`) and it shows a zero-info holding page (`#holding`: just the "RIOT" wordmark with an occasional chromatic-split glitch — rose ghost left, blue ghost right (a deliberate, user-directed exception to the chrome-accent palette, holding page only), static under reduced motion) and skips the whole boot — no `mpInit`, so parked tabs never appear in room presence. Carries the visible **version tag** (see Conventions). |
| `style.css` | All viewer CSS — the «l'acta» ballot-paper theme (tokens + doctrine in `.claude/skills/riot-ui/SKILL.md`). |
| `app.js` | Viewer core: city config/state, the booth (card stack, stamp + after-vote split beat, deck modes incl. `?deck=live`), the reveal screen, join onboarding, city switcher. Votes live in memory only. **Identity is per-TAB** (sessionStorage, like `mpPid`): every new browser session/window re-prompts the join gate — the room never remembers who you were (the legacy localStorage copy is purged at load). Your chosen face renders top-right as the **me-badge** (`#meBadge`, `updateMeBadge()`, the `.face.me` idiom) — your own "account" mark, hidden on the lobby letterhead and moderator chrome. |
| `map.js` | The affinity map (reveal-only): a 2D opinion space, animated entrance. **Nine projections**, picked from the `#mapProj` chip row under the map. The default is **`Room`** (`projJoint`): parties AND participants are rows of one matrix over the deck's decisions, mapped by its first two principal components — a party is just a labelled row, placed by the same `(row-mean)·axis` score as you; the room shapes the axes through an anonymous aggregate (see Conventions). The other eight (classical MDS, PCA, CA, kernel PCA, SMACOF, Sammon, spectral, t-SNE — vanilla JS over the shared Jacobi eigensolver) place parties only and drop each ballot in **out-of-sample** by single-point stress majorization (`projectBallotIn`) so it fits its vote-distances to the fixed party dots — it can leave the hull and sit beside the party it votes with, instead of the old convex blend that pinned every ballot to the centroid. All projections are Procrustes-aligned to the MDS baseline (a participant rides the same transform via `procrustesT`) so switching morphs the dots in place instead of spinning the map. The active placement fn is `PLACE` (joint score vs out-of-sample), used for you and peers alike. Presence publishes a CANONICAL position (`publishCoord`: the joint room frame when a room is active, else MDS), independent of the local pick. In live sessions every participant — synthetic voters included — is projected from their full cast-marker ballot (`LIVE.peerVotes` → `blendCoord`), peer dots keyed by pid so they morph too; outside live, a peer sits where it published. |
| `views.js` | Secondary views: the minutes (raw-data log, one tap via the header `§`; a page-wide provenance pill toggles every title between the AI-reworded headline and the source's own wording), party comparison, **curator mode** (moderator-only: `?role=moderator` reveals a Curator switch on the Minutes page — review checks on each row + marks-JSON download; a persisted dev flag never activates on a plain voter URL), votes export/import (importing lands straight on the reveal — even a partial set skips the remaining cards; ↻ re-deals), options sheet. |
| `multiplayer.js` | The room (Firebase Realtime DB): presence with names/emoji, anonymous per-decision tallies, the joint-map second-moment aggregate (`rooms/<room>/cov`, contributed once at reveal via `mpContributeCov`, read back into `jointDataChanged`), room progress, activity ticks, curator room reset; single-player fallback; `?simroom=N` fakes a room for testing (sim peers carry a fabricated ballot that drives both their map dot and the aggregate). |
| `live.js` | **LIVE SESSION** — lockstep room voting (lobby → per-card voting/reveal → final reveal; everyone on the same card). State machine in `rooms/<city>/live` (RTDB), written ONLY by the moderator client (`?role=moderator`, whose screen doubles as the projector/stage view). Voters write an anonymous tally increment + a `cast` marker carrying their direction (reveal-only; see Conventions); countdown renders from a server-clock deadline (`.info/serverTimeOffset`); timeouts are recorded nowhere and so are auto-excluded from affinity. Per-card reveal: the chamber's official stamp first, then the room as emoji piles — party detail stays in the final reveal/minutes. The voter lobby is the **convocation document** (all copy from `CFG.lobby`, docket period/count computed from the active deck); on open it falls away to the chair's formula (`sittingOpenedFormula`, ~1.6s) before the first card lands. **Lobby refresh hold:** while seated, a sessionStorage flag (`riot.liveLobby` = city id) lets the inline `<head>` script in `index.html` tag `html.lvhold` BEFORE first paint, so a refresh shows clean paper → the CFG-prefilled document at boot → the snapshot-confirmed lobby, never a flash of the booth shell while Firebase reconnects; `lvHold()` renews/clears the flag and retires the class once real state lands (stale flag + no session ⇒ booth returns after a short grace). **Synthetic voters:** `cfg.bots` (moderator setup option, "synthetic voters", 0–24) seats N fake people in the room to stage how a fuller session looks — real participant records + random tally/cast writes from the moderator's client (presence via `PEERS` in sim rooms / `mpPart` on Firebase; casts via `lvStore` either way), so every phone renders them exactly like humans: lobby faces, ballots-in counts, reveal piles. Human-ish timing (spread + deadline cluster + the odd timeout), deterministic pids (`bot<i>`) so a reloaded moderator re-adopts them, `onDisconnect` + session end remove them. **AI mode:** `cfg.ai` (moderator setup switch, "AI proxy" — shown only when the city ships `AI_VOTES`) seats Proxy IA as a party in the reveal for the WHOLE room: every client mirrors the session flag on each snapshot (`liveSyncAI` → `applyAiParty`), a voter parked on the final screen keeps it, and back-to-booth resets it — the old per-visitor ⚙ "Show AI proxy" toggle is gone (its `riot.ai.v1` key is purged at load). **The stage join moment:** the lobby stage shows a scannable QR (`qrSVG` — inline ink SVG via the vendored `assets/qrcode.min.js`) above the join URL, and that URL ALWAYS carries `?city=<id>` — even for Reus — because the bare URL is the holding page, not an entrance. Voters arrive over presence, not session writes, so the `renderStrip` wrapper also re-renders the moderator's stage while the state is `lobby` (without it the gathering faces never refresh — nothing touches the session node until the sitting opens). |
| `cities/<id>/config.js` | Per-city chrome + tunables: `window.CITY_CONFIG` (name, logo, document `lang`, source-document `srcLang` for the original-wording toggle, `chamber` for live-session copy, `lobby` — ALL live-lobby strings: eyebrow / headline / body / docketInstitutionLine / docketCountLine (`{period}`/`{n}` computed from the active deck) / statusWaiting / privacyLine / disclosure / sittingOpenedFormula, `mapGate`). |
| `cities/<id>/data.js` | `window.RIOT = {...}` — that city's decisions table as a JS object (avoids CORS). **Generated** by `build_table.py` (Reus) / `build_table_bxl.py` (Brussels). |
| `cities/<id>/ai_votes.js` | `window.AI_VOTES = {...}` — the AI proxy's votes (Reus only so far). |
| `firebase-config.js` | `window.FIREBASE_CONFIG` — multiplayer backend config. Set to `null` for single-player. The apiKey is not a secret; access is governed by the DB rules. |
| `her.js` | "Her" (2013) OS1 mark animation — the AI proxy's visual identity (Three.js via CDN). |
| `scripts/` | The Python pipelines, Reus + `*_bxl.py` Brussels (see Commands). |
| `data/decisions.json` | **The Reus core table** — top-level metadata + `decisions[]` (one row per decision). The committed source of truth. |
| `data/ai_votes.json` | AI proxy votes (mirror of `cities/reus/ai_votes.js`). |
| `data/curator_marks.json`, `data/auto_discretion.json` | Human curator flags + auto-detected low-discretion proposals (Reus). |
| `data/actas/*.txt` | Reus source plenary minutes (PDF → `pdftotext`). |
| `data/raw/` | Reus pipeline intermediates + session index (`sessions.json`). **Audit trail — never delete.** |
| `data/expedients/` | Reus source PDFs + per-decision metadata (re-fetchable). |
| `data/brussels/` | The Brussels layer: `cri_txt/` (committed CRI text; `cri_pdf/` is gitignored, re-fetchable), `votes_raw.json` (per-MEMBER roll-calls), `roster.json` (member → political group), `cards.json` (English card copy, authored separately), `decisions_skeleton.json`. |
| `assets/logos/` | Party/group logos + brand assets. |
| `assets/qrcode.min.js` | Vendored QR encoder (qrcode-generator 1.4.4, MIT) — the stage lobby's join QR (`qrSVG` in `live.js` draws it as inline ink SVG). |
| `docs/` | Canonical working docs — see "Where to read more". |
| `.claude/skills/` | Agent skills: `screenshot/` (self-contained headless-Chromium driver — serves the app, stubs Firebase so test runs never join the live rooms, screenshots every screen; **use it to verify any UI change**), `riot-ui/` (the project's concrete design system: tokens, reserved palettes, vote semantics, idioms), `frontend-design/` (Anthropic's general design-quality skill, vendored). |
| `Riot.md`, `To Do Riot.md` | Vision/non-negotiables + phased build plan. |
| `soul.md` | The proxy's private profile. **Gitignored, never committed.** |

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

# Phase 4 — the AI proxy. Reads soul.md + each decision's neutral context → blind vote.
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

# Aggregate members → groups via roster.json, merge cards.json → cities/brussels/data.js.
# Prints a validation report: roster coverage (any unmapped voter is a bug) and
# per-group bloc consistency.
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

- **Blind voting.** The AI proxy's only inputs are `soul.md` + a decision's
  *neutral, citizen-visible* context. It must never see Rob's votes, party votes,
  or the outcome. Preserve this firewall in any code touching `ai_vote.py`.
- **Card copy is governed by [`docs/CARD_STYLE.md`](docs/CARD_STYLE.md) — strict.**
  Any agent writing or editing card copy (headlines, briefs, deep layers) must
  read it first. The two recurring failure modes: jargon headlines (ETS,
  ordinance numbers, article references) and **own-vote leaks** — a card's own
  result, tally, party list, or "unanimous" tell appearing anywhere in its copy
  or deep layers, which un-blinds the user before they vote.
- **Two-layer separation.** `deep_facts` = neutral, the AI proxy's *only* deep
  input. `deep_lectura` = analyst opinion/inference, **human-facing only, never
  an AI input.** Do not blur them.
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

- **Frontend:** vanilla HTML/CSS/JS, no framework, no build step; Three.js (CDN)
  for `her.js`; Archivo + Courier Prime via Google Fonts (CDN); CSS custom
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
- **No linters or formatters configured; no automated tests.** Validation is
  manual: cross-check the tables against the source actas/CRIs (the Brussels
  build prints its own roster/bloc-consistency report), curator review of copy
  before merge, and the AI hit-rate as the real metric.
- **Commits** are descriptive (verb + object), live-deploy style.

## Privacy

`soul.md` (the proxy's profile, and its `soul.*.md` variants) and Rob's own votes
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
