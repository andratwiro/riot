# RIOT — riot.reus

**Can an AI proxy faithfully represent a citizen's political will on real council decisions?**
RIOT exists to prove it, then scale. It makes political representation *falsifiable* — you can
check whether a proxy (or a party) actually votes the way you would.

The engine is jurisdiction-agnostic and now runs **multiple cities** — **Reus**
city council (`riot.reus`) and the **Brussels-Capital Parliament**
(`riot.brussels`).

> 🔗 **Live:** https://andratwiro.github.io/riot/ — switch city from the header,
> or append `?city=brussels`.
>
> 🧭 **Why this exists:** [`VISION.md`](VISION.md).

## What's here
- **The site** (`index.html` + per-city `cities/<id>/` bundles) — a Polis-style, interactive
  view of real council/parliament decisions: vote on the contested ones, see your affinity with
  each party and a 2D opinion map, and compare against an AI proxy — each decision citizen-legible
  and linked back to its source. A `?city=` loader + header selector switch between cities.
- **Multiplayer** (optional, Firebase Realtime DB) — each city is a shared room: invite people and
  watch everyone land on the same map. Degrades to single-player when unconfigured.
- **The data** — `data/decisions.json` (Reus) and `data/brussels/` (Brussels CRIs + cards) are the
  committed sources, compiled into the `cities/<id>/data.js` bundles.
- **The pipeline** (`scripts/`) — Reus: `fetch_sessions.py` → `extract_votes.py` →
  `build_table.py` (→ `cities/reus/data.js`). Brussels has parallel `*_bxl.py` variants that
  parse the Parliament CRIs (→ `cities/brussels/data.js`).

## How it works (v1 — single-user proof)
Rob votes manually on contested council decisions (stored device-locally). An AI proxy votes
**blind** from a private profile (`soul.md`, gitignored) + each decision's context — never from
Rob's votes. Parties contribute their real recorded votes. We then compare Rob vs each party vs
the AI proxy (affinity % + a 2D map), and report the AI's **out-of-sample** hit-rate against
Rob's votes — the actual proof.

See [`VISION.md`](VISION.md) for the vision and where it's going, [`Riot.md`](Riot.md) for the
non-negotiables, [`To Do Riot.md`](To%20Do%20Riot.md) for the build plan, [`AGENTS.md`](AGENTS.md)
for a repo orientation, and [`docs/FINDINGS.md`](docs/FINDINGS.md) for the working knowledge
(data sources, council composition, extraction method).

## Data provenance
All vote data is derived from public records: Reus city council's plenary minutes (*actes del ple*)
on the [AudioVideoActa portal](https://serveis.reus.cat/actes), and the Brussels-Capital
Parliament's plenary *comptes rendus intégraux* (CRIs). Every decision links back to its source.

## Privacy
`soul.md` (the proxy's profile) and Rob's own votes are never committed — the repo is public, the
private inputs are not.
