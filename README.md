# RIOT

**Can an AI proxy faithfully represent a citizen's political will on real council decisions?**
RIOT exists to prove it, then scale. It makes political representation *falsifiable* — you can
check whether a proxy (or a party) actually votes the way you would.

The engine is jurisdiction-agnostic and currently runs two instances behind one shared viewer:
**Reus** (`?city=reus`, city council — the original proof) and **Brussels** (`?city=brussels`,
the Brussels-Capital regional Parliament).

> 🔗 **Live:** https://andratwiro.github.io/riot/

## What's here
- **The site** (`index.html` + `style.css` + `app.js`/`map.js`/`views.js`/`multiplayer.js`,
  with per-city `cities/<id>/` bundles) — swipe through real council
  decisions, vote yourself, and see your affinity with each party (Polis-style affinity bar +
  2D opinion map), with a citizen-legible explanation and a link back to the source minutes.
  Optional shared rooms (Firebase) show other live participants; without it the site runs
  single-player.
- **The data** — `data/decisions.json` (Reus) and `data/brussels/` (roll-calls, roster, cards)
  are the committed tables. `data/actas/*.txt` and `data/brussels/cri_txt/` are the source
  minutes; `data/raw/` holds the session index and per-session extractions.
- **The pipelines** (`scripts/`):
  - Reus: `fetch_sessions.py` → `extract_votes.py` → `build_table.py` → `cities/reus/data.js`;
    `ai_vote.py` produces the AI proxy's blind votes.
  - Brussels: `fetch_sessions_bxl.py` → `extract_votes_bxl.py` → `build_table_bxl.py` →
    `cities/brussels/data.js`.

## How it works (v1 — single-user proof)
Rob votes manually on contested council decisions (stored device-locally). An AI proxy votes
**blind** from a private profile (`soul.md`, gitignored) + each decision's context — never from
Rob's votes. Parties contribute their real recorded votes. We then compare Rob vs each party vs
the AI proxy (affinity % + a 2D map), and report the AI's **out-of-sample** hit-rate against
Rob's votes — the actual proof.

See [`Riot.md`](Riot.md) for the full rationale and non-negotiables, [`To Do Riot.md`](To%20Do%20Riot.md)
for the build plan, [`AGENTS.md`](AGENTS.md) for the repo orientation, and
[`docs/FINDINGS.md`](docs/FINDINGS.md) for the working knowledge (data sources, council
composition, extraction method).

## Data provenance
All vote data is derived from public records: Reus city council's plenary minutes (*actes del
ple*) on the [AudioVideoActa portal](https://serveis.reus.cat/actes), and the Brussels-Capital
Parliament's plenary *comptes rendus intégraux* (CRIs) on [weblex.brussels](http://weblex.brussels).
Every decision links back to its source.

## Privacy
`soul.md` (the proxy's profile) and Rob's own votes are never committed — the repo is public, the
private inputs are not.
