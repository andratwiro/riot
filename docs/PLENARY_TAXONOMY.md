# RIOT — plenary item taxonomy (the structural / "votability" layer)

> What can appear on a `ple` agenda, and which of it is actually a *decision*. This is the
> layer that decides what reaches the card deck vs. what stays in the raw verification view.
> Implemented in `scripts/classify.py`; consumed by `scripts/build_table.py`; surfaced in the
> raw log of `index.html`. Last updated: 2026-06-08.

## Why this exists
A council insider's feedback (reviewing an early build): *"not everything makes sense to vote
for or against — some things are just legally required to be presented, and everyone votes for
them."* She's right, and it's not a UI nicety — it's the law. An ordinary `ple` is split into
two halves (LRBRL art. 46.2; ROF, RD 2568/1986; Reus ROM in force 2020):

- **Part resolutiva** — the council *decides*. Items get voted (`for/against/abstain`). RIOT's material.
- **Part de control** — the opposition holds the government to account. **Most of this is not a
  yes/no decision at all** and must never enter the affinity/map maths.

So every agenda point carries two **orthogonal** flags, each answering one question:

| Flag | Question | Set where | Gates |
|---|---|---|---|
| `votable` | Is this even a decision? (structural) | `classify.py`, **now** | the card deck |
| `counts`  | Among decisions, is it contested/divisive? (political) | Phase 2, later | affinity + 2D map |

A point can be `votable=true, counts=false` (unanimous honors). A `votable=false` point is never
in either. Keeping them separate is the whole point — conflating them inflates everyone to ~90%
affinity and collapses the map.

## The closed vocabulary (`kind`)
Backbone: ROF art. 97 (dictamen · proposició · moció · vot particular · esmena · prec · pregunta)
plus the non-art.97 tràmit items (donar compte, info, acta).

| `kind` | part | `votable` | What it is | Detection signal in the acta |
|---|---|---|---|---|
| `dictamen` | resolutiva | ✅ | Govern proposal vetted by a *comissió informativa* | `type=proposta`; under a committee-area header (`SERVEIS A LES PERSONES`, `…TERRITORI I URBANISME`, `PROMOCIÓ ECONÒMICA…`, `SERVEIS GENERALS`) |
| `proposicio` | resolutiva | ✅ | Resolutive item not via the standard route | `type=proposició`; `PROPOSTES DELS GRUPS MUNICIPALS` |
| `mocio` | resolutiva | ✅ | Proposal direct to the ple, mostly opposition | `type=moció`; title `Moció…`; `MOCIONS DELS GRUPS MUNICIPALS` / `MOCIONS DE L'ALCALDIA` |
| `ratificacio` | resolutiva | ✅ | Ratify a decree/urgency that carries a real vote | title `Ratificar…` / `ratificació` |
| `declaracio` | resolutiva | ✅ | Declaració institucional (often *per assentiment*) | `declaració institucional` |
| `donar_compte` | control | ❌ | *Dació de compte*: ple "es dóna per assabentat" | verb `Donar compte de…` |
| `info` | control | ❌ | Informació de l'Alcaldia | `Informació de l'Alcaldia` |
| `acta` | tràmit | ❌ | Approve previous session's minutes | `Aprovació de l'acta…` |
| `prec` | control | ❌ | *Ruego*: debated, **"en cap cas sotmès a votació"** | `PRECS I PREGUNTES` section |
| `pregunta` | control | ❌ | Question to government — gets an answer, not a vote | `PRECS I PREGUNTES` section |
| `altres` | — | ❌ | Unclassified fallback — **review** | none matched |

## Detection & the grounding rule
`classify(d)` resolves `kind` in order: (1) normalise the verbatim `type` token; (2) else match
title/verb regexes; (3) else `altres`. Then it applies the **grounding override** — the honest
rule that keeps `votable` true to what actually happened, not just how the agenda labelled it:

- If the acta records a **real vote** (a `tally` count, or `outcome ∈ {approved,rejected}`),
  `votable=true` regardless of `kind`. (Catches a *donar compte* that the ple then ratifies.)
- A control/tràmit item with **no** tally is `votable=false`.

## Edge cases (encoded)
- **Ratificació de la urgència** — the procedural urgency vote before a moció is debated is a real
  vote but not the political decision. If extracted, mark the urgency vote `kind=ratificacio`/
  procedural and keep only the substantive vote on the card.
- **Declaració institucional** — technically votable, usually ceremonial (`per assentiment`). Let it
  through as `votable=true`; the later `counts` filter drops it. Don't special-case now.
- **Point-by-point motions** (`Sotmès el punt X…`) — one row per sub-point, as today.

## ⚠️ Impact on data capture — for ALL plens (the important bit)
The current `parsed_<code>.json` files were extracted **votable-only**: every *donar compte*,
*prec* and *pregunta* was silently dropped. Proof — `python3 scripts/classify.py` over the 3
extracted sessions reports **49 votable / 0 non-votable**. So today the "raw view" is blind to the
entire **control half** of every plenary.

To honour *"tag everything in the raw view, cards bring only votable stuff"*, the extraction scope
must **expand** when we process the remaining ~32 sessions (and re-do the 3 if we want them whole):

1. **Capture every numbered agenda point**, including non-votable ones, not just the voted outcomes.
2. For non-votable points: set `type`/`kind` accordingly, leave `tally` null, `party_votes` `{}`,
   `outcome`/`decided` null. `classify` will mark them `votable=false` → raw view only.
3. Carry the **agenda section header** (the ALL-CAPS line above the point) when present — it makes
   `dictamen` vs `mocio` vs control deterministic and gives a free committee-area topic tag.
4. Re-run `build_table.py`; the card deck auto-excludes the new non-votable rows (filters
   `d.votable !== false`), the raw log shows them with a `kind` chip.

Cost note: the non-votable half is *cheaper* to capture (no vote tally to reconcile) — it's mostly
title + section + type. It roughly doubles row count per session but adds little reconciliation work.

## Files
- `scripts/classify.py` — the classifier + `__main__` histogram (run it to audit capture).
- `scripts/build_table.py` — adds `kind` · `votable` · `part` to every row; `n_votable` in the table.
- `index.html` — card deck filters `votable`; raw log shows the `kind` chip (`KLAB`).
