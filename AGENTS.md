# AGENTS.md — RIOT (multi-city: `riot.reus`, `riot.brussels`)

> Orientation file for AI agents (and humans) working in this repo. Read this
> first; it should be enough to act without reading every file. For the *why* and
> where it's going, see [`VISION.md`](VISION.md); for the non-negotiables, see
> [`Riot.md`](Riot.md).

## What this is

**RIOT** asks a falsifiable question: *can an AI proxy faithfully represent a
citizen's political will on real council decisions?* The viewer is now
**multi-city**: **Reus** city council (`?city=reus`, Catalan) and the
**Brussels-Capital Parliament** (`?city=brussels`, English UI / French source),
each with its own data bundle. The engine is jurisdiction-agnostic.

The proof: Rob votes manually on contested Reus city-council decisions (stored
device-locally). An AI proxy votes **blind** — from a private profile
(`soul.md`, gitignored) plus each decision's *neutral* context, never from Rob's
votes, the parties' votes, or the outcome. Parties contribute their real recorded
votes. We then compare Rob vs each party vs the AI, and report the AI's
**out-of-sample hit-rate** against Rob's votes. That hit-rate is the actual proof.

It is a **static site** (`index.html` + per-city bundles under `cities/`) on
GitHub Pages, fed by a **Python data pipeline** (`scripts/`) that downloads
plenary minutes and extracts per-decision vote tables. **No build step, no package
manager.** *Optional* **multiplayer** is layered on via Firebase Realtime DB
(`firebase-config.js`) — each city is a shared room (presence + peer dots on the
map); it **degrades cleanly to single-player** when no Firebase config is present.

🔗 Live: https://andratwiro.github.io/riot/ (append `?city=brussels` for Brussels)

## Repo map

| Path | What it is |
|------|------------|
| `index.html` | The shared viewer (vanilla HTML/CSS/JS): Polis-style affinity bar, 2D opinion map, decision card-stack, header **city selector**. A `?city=` loader (`document.write`, parser-synchronous) pulls the active city's `config.js` + `data.js` + `ai_votes.js`. Reads `window.CITY_CONFIG` / `window.RIOT` / `window.AI_VOTES`. Per-tab identity via `sessionStorage`; user votes in `localStorage` (never committed). |
| `cities/<id>/` | Per-city bundle: `config.js` (`window.CITY_CONFIG` — chrome/lang/`mapGate`), `data.js` (`window.RIOT` — the decisions table), `ai_votes.js` (`window.AI_VOTES`). Cities today: `reus`, `brussels`. **Generated** (Reus by `build_table.py`, Brussels by `build_table_bxl.py`). |
| `firebase-config.js` | `window.FIREBASE_CONFIG` for the optional multiplayer rooms (RTDB, `europe-west1`). Web apiKey is committed by design — **access is governed by RTDB security rules**, so keep those locked. Null/absent ⇒ single-player. |
| `her.js` | "Her" (2013) OS1 mark animation — the AI proxy's visual identity. |
| `scripts/` | The Python pipeline (see Commands). `*_bxl.py` are the Brussels variants. |
| `data/decisions.json` | **The Reus core table** — top-level metadata + `decisions[]` (one row per decision); `build_table.py` compiles it into `cities/reus/data.js`. |
| `data/ai_votes.json` | Reus AI proxy votes (mirror of `cities/reus/ai_votes.js`). |
| `data/curator_marks.json`, `data/auto_discretion.json` | Human curator flags + auto-detected low-discretion proposals. |
| `data/actas/*.txt` | Reus source plenary minutes (PDF → `pdftotext`). |
| `data/brussels/` | Brussels source + cards: `cri_txt/<session>/*.txt` (plenary CRIs, FR/NL), `cards.json` + `cards_parts/` (curated three-layer decisions); compiled into `cities/brussels/data.js` by `build_table_bxl.py`. |
| `data/raw/` | Reus pipeline intermediates + session index (`sessions.json`). **Audit trail — never delete.** |
| `data/expedients/` | Reus source PDFs + per-decision metadata (re-fetchable). |
| `assets/logos/` | Party logos + brand assets. |
| `docs/` | Canonical working docs — see "Where to read more". |
| `VISION.md`, `Riot.md`, `To Do Riot.md` | The *why* + roadmap, the non-negotiables, the phased build plan. |
| `soul.md` | The proxy's private profile. **Gitignored, never committed.** |

## Commands

No `package.json`, no `requirements.txt`, no tests. The pipeline is run manually
with Python 3. External deps: the `anthropic` SDK (for `ai_vote.py`) and the
`pdftotext` binary (poppler).

```bash
# Phase 0 — enumerate Ple sessions, download + verify each acta PDF → data/actas/*.txt
python3 scripts/fetch_sessions.py

# Corpus survey — regex pass over actas to find/quantify vote outcomes
python3 scripts/extract_votes.py

# Build the Reus table — merge data/raw/parsed_<code>.json (per-session,
# facts-only LLM extraction) → data/decisions.json AND cities/reus/data.js
python3 scripts/build_table.py

# Brussels has a parallel pipeline (CRIs → cards → bundle): scripts/*_bxl.py
python3 scripts/fetch_sessions_bxl.py   # CRIs
python3 scripts/extract_votes_bxl.py    # roll-call → groups
python3 scripts/build_table_bxl.py      # → cities/brussels/data.js

# Phase 4 — the AI proxy. Reads soul.md + each decision's neutral context → blind vote.
# Needs ANTHROPIC_API_KEY in env and soul.md present.
python3 scripts/ai_vote.py [--only-missing | --ids <id...> | --limit N | --dry-run]

# Curator gate — auto-flag low-discretion items (proposes drops; never disposes)
python3 scripts/detect_discretion.py
```

`scripts/taxonomy.py` is a library, not a CLI: the **canonical legal-category
taxonomy** and votability gate, imported by the extraction/build steps.
(`enrich_tax_cards.py`, `rewrite_headlines.py` are domain-specific copy helpers.)

**Deploy = push to `main`** — GitHub Pages serves the repo directly. After any
change to a city's source, re-run that city's `build_table*.py` so the
`cities/<id>/data.js` bundle stays in sync. Adding a city = a new `cities/<id>/`
bundle + an entry in the header selector's known-cities list in `index.html`.

## Data model

`data/decisions.json` is `{ generated_for, note, parties[], sessions_in_table[],
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

`parties[]` carries `{ token, name, color, logo }` (Reus: PSC, JxR/Junts, ERC,
CUP, VOX, PP; Brussels: its ~13 parliamentary groups — same shape). AI votes live
separately in `ai_votes.json`
(`{ model, produced_via, soul_hash, n_votes, note, votes }`), not inside
`decisions.json`.

## Architecture & non-negotiables

- **Blind voting.** The AI proxy's only inputs are `soul.md` + a decision's
  *neutral, citizen-visible* context. It must never see Rob's votes, party votes,
  or the outcome. Preserve this firewall in any code touching `ai_vote.py`.
- **Two-layer separation.** `deep_facts` = neutral, the AI proxy's *only* deep
  input. `deep_lectura` = analyst opinion/inference, **human-facing only, never
  an AI input.** Do not blur them.
- **`taxonomy.py` is the single source of truth** for what a Ple item legally is
  and therefore whether it is a votable decision. Don't fork that logic.
- **Falsifiability first.** Every decision links back to its source acta; no magic
  numbers, no hidden steps. The out-of-sample hit-rate is the deliverable.
- **`data/raw/` is an audit trail** — additive, never deleted.
- **Static site, push-to-deploy.** No build step, no in-browser LLM calls; the AI
  votes are produced offline and committed per city. The *only* backend is the
  optional Firebase Realtime DB for multiplayer presence — and the app must keep
  working (single-player) when it's absent.
- **Multi-city by data, not by fork.** One shared `index.html`; a city is a
  `cities/<id>/` data+config bundle selected by `?city=`. Keep city-specific
  content in the bundle, not in the viewer.

## Conventions

- **Frontend:** vanilla HTML/CSS/JS, no framework; Three.js (CDN) for `her.js`;
  CSS custom properties for theming.
- **Pipeline:** Python 3, stdlib + `anthropic`; module + function docstrings;
  snake_case. JS uses kebab/camelCase.
- **No linters or formatters configured; no automated tests.** Validation is
  manual: cross-check `decisions.json` against the source actas, curator review of
  copy before merge, and the AI hit-rate as the real metric.
- **Commits** are descriptive (verb + object), live-deploy style.

## Privacy

`soul.md` (the proxy's profile, and its `soul.*.md` variants) and Rob's own votes
are **never committed** — the repo is public, the private inputs are not. Rob's
manual votes live only in browser `localStorage`. Never add either to the repo.

## Where to read more

| Doc | Read it for |
|-----|-------------|
| [`VISION.md`](VISION.md) | The *why*: bandwidth thesis, the two-engine machine (deliberation + proxy), where it's going |
| [`docs/GOVOCAL_PITCH.md`](docs/GOVOCAL_PITCH.md) | The pitch to rally GoVocal around RIOT |
| [`Riot.md`](Riot.md) | The bet, goals, non-negotiables, what's out of scope |
| [`To Do Riot.md`](To%20Do%20Riot.md) | The phased build plan (phases 0–7) |
| [`docs/FINDINGS.md`](docs/FINDINGS.md) | Data sources, Reus council composition, extraction method/status, legal taxonomy |
| [`docs/DEEP_DIVE.md`](docs/DEEP_DIVE.md) | The per-item analysis pipeline (neutral facts → opinion layers) |
| [`docs/CARD_STYLE.md`](docs/CARD_STYLE.md) | Canonical copy rules for decision cards (strict) |
| [`README.md`](README.md) | Public-facing project intro |
