# RIOT — riot.reus

> **For Claude Code:** standing context for building RIOT — read this first. It fixes the *why*, the goals, and the non-negotiable design principles. Implementation (libraries, code structure, UI) is your call; iterate with Rob. Written self-contained on purpose.

## Name
**RIOT.** This build is the Reus instance, **riot.reus**. The engine is jurisdiction-agnostic — later instances (riot.brussels, …) run the same thing on a different council.

## The bet
Can an AI proxy faithfully represent a citizen's political will on real council decisions? RIOT exists to prove it, then scale. It removes the monopoly on defining what citizens want by making representation **falsifiable** — you can check whether a proxy (or a party) actually votes the way you would. Part of the broader Cort project; RIOT is its citizen-facing end (the insider depth engine is a separate sibling, "Opposition Copilot").

RIOT starts from the **citizen's question**, not the document: *what is the council deciding, do I agree, are they voting in my interest?* — with optional progressive depth behind each decision (the deep end is where it meets Cort's "Deliberative Spaces").

## Goal arc
- **v1 — single-user proof (now):** Rob votes on real Reus council decisions; his AI proxy votes blind from `soul.md`; compare Rob vs each party vs the AI proxy; show affinity % + a Polis-style 2D map. **What this proves:** the AI predicts Rob's *unseen* votes (out-of-sample) — not that it beats the parties.
- **Later — citizen-scale:** citizens hook up their own proxies + identity verification → a live collective political map; abstract to other councils.

## Non-negotiables (these don't change; everything else can)
- **Blind voting.** Rob votes manually. The AI votes only from `soul.md` + the decision + its context — never from Rob's votes. Parties contribute their real recorded votes. Only affinity % is shown.
- **Out-of-sample is the proof.** `soul.md` is a *general* profile, not fit to these votes. The metric that matters is how often the AI calls Rob's actual votes right — especially held-out / future ones. "AI is Rob's closest party" is near-guaranteed and proves nothing. Never tune `soul.md` against the votes.
- **Contested-filter is core.** Score only on politically-charged, divisive decisions; flag unanimous / ceremonial ones out (`counts=false`). Leaving them in inflates everyone to ~90% affinity and collapses the map into a blob.
- **Source-traceable.** Every decision links back to its source document. Falsifiability depends on it.
- **Compression layer.** Each decision gets a citizen-legible explanation ("they're doing X, it costs you Y") derived from the source *without losing the thread back to it*. The same context feeds both Rob's and the AI's votes — neither votes on a bare title. This is the hard, bias-prone part; keep it honest and sourced.

## Data model
One committed JSON table, one row per decision:
`id · title · date · body (òrgan) · source_url · context (the compressed explanation) · votes { party_A …, rob, ai } each ∈ {for, against, abstain} · counts (bool: contested & political?)`
This one table is the store, the affinity input, and the 2D-map input.

## Architecture (decided — minimum dependencies)
- **Public GitHub repo** — council data is public, and a public repo gets free GitHub Pages.
- **Static site on GitHub Pages** — no backend, no external services, no Cloudflare. Vanilla where possible; add a library only if it earns its place.
- **AI votes precomputed offline by Claude Code, triggered manually by Rob** — a script reads `soul.md` + each decision's context, produces the AI's vote, writes it into the table. No in-browser LLM calls.
- **`soul.md` is gitignored** — local/private, never committed; only the AI's *votes* (its outputs) are committed.
- **Rob's votes live in browser `localStorage`** — device-local, never committed, so private even with a public repo. Real votes, not faked.
- **Affinity % and the 2D map computed client-side** — PCA on the decisions × voters matrix (same maths Polis uses; not clustering — there are only ~6 parties).
- **Deploy:** GitHub Pages from the public repo → a live URL. (This instance is *riot.reus*; a custom domain can point at it later.)

## Out of scope for v1
Backend / DB server, multi-user, identity verification, in-browser AI voting, real-time updates, the citizen-scale collective map. All deferred until the single-user proof lands.