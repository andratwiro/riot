# RIOT — riot.reus

**Can an AI proxy faithfully represent a citizen's political will on real council decisions?**
RIOT exists to prove it, then scale. It makes political representation *falsifiable* — you can
check whether a proxy (or a party) actually votes the way you would.

This is the **Reus** instance (`riot.reus`). The engine is jurisdiction-agnostic.

> 🔗 **Live:** _(GitHub Pages URL — added on first deploy)_

## What's here
- **The site** (`index.html` + `data.js`) — a Polis-style view of real Reus city-council
  decisions with each party's recorded vote, the citizen-legible explanation, and a link back
  to the source acta. Currently shows the **vote-extraction verification view** (for checking
  data integrity before the comparison/affinity layers land).
- **The data** — `data/decisions.json` is the one committed table (one row per decision).
  `data/actas/*.txt` are the source minutes; `data/raw/` holds the session index and per-session
  extractions.
- **The pipeline** (`scripts/`):
  - `fetch_sessions.py` — enumerate Ple sessions → download + verify each acta → `data/actas/*.txt`
  - `extract_votes.py` — regex corpus survey of vote outcomes
  - `build_table.py` — merge per-session extractions → `data/decisions.json` + `data.js`

## How it works (v1 — single-user proof)
Rob votes manually on contested council decisions (stored device-locally). An AI proxy votes
**blind** from a private profile (`soul.md`, gitignored) + each decision's context — never from
Rob's votes. Parties contribute their real recorded votes. We then compare Rob vs each party vs
the AI proxy (affinity % + a 2D map), and report the AI's **out-of-sample** hit-rate against
Rob's votes — the actual proof.

See [`Riot.md`](Riot.md) for the full rationale and non-negotiables, [`To Do Riot.md`](To%20Do%20Riot.md)
for the build plan, and [`docs/FINDINGS.md`](docs/FINDINGS.md) for the working knowledge
(data sources, council composition, extraction method).

## Data provenance
All vote data is derived from Reus city council's public plenary minutes (*actes del ple*) on the
[AudioVideoActa portal](https://serveis.reus.cat/actes). Every decision links back to its source.

## Privacy
`soul.md` (the proxy's profile) and Rob's own votes are never committed — the repo is public, the
private inputs are not.
