# RIOT — Phase 0 findings & working knowledge (riot.reus)

> Durable notes so the work survives any single session. The *why*/principles live in
> `Riot.md`; the plan in `To Do Riot.md`. This file = what we've **learned** building it.
> Last updated: 2026-06-08 (day 0).

## Where Reus' votes live (the gate — cleared)
- Full plenary minutes ("actes del ple") are published as PDFs on the **AudioVideoActa
  portal**: `https://serveis.reus.cat/actes`.
- Session list endpoint (POST/GET, paginated):
  `…/actes/session/fragmentCustom?sessionTypeId=<type>&startDate=dd/MM/yy&endDate=dd/MM/yy&search=yes&max=500`
  - **Ple Municipal** sessionTypeId = `40287112575192c001575192edd3000d`
    (the other type is Junta de Govern Local = the executive — we ignore it).
- Each session has a **detail page** `…/session/sessionDetail/<detailId>` listing
  document links `…/session/downloadItem/<docId>`: the agenda, the **acta**, and one PDF
  per motion ("Moció GM …").
- PDFs are FlateDecode-compressed → WebFetch can't read them. **Download the bytes and run
  `pdftotext -layout`** (poppler; already installed).

### The acta-location gotcha (important)
A session's **own minutes are usually NOT on its own page.** A session's detail page hosts
the *previous* sessions' draft actas (submitted there for approval that day). So you can't
"grab the esborrany on this page" — you'd get the wrong session. The robust rule we use:
- Every acta document's **title carries the date it refers to**:
  - final: filename `PLE_11_2024_ORD_acta_240920.pdf` → 2024-09-20
  - draft: `Esborrany Acta Ple 17 de maig de 2024` → 2024-05-17
    (Catalan months; vowel-initial months use the apostrophe form `d'octubre`, `d'abril`, `d'agost`).
- Scan **all** session pages, collect every acta doc + its referenced date, then assign each
  session the doc whose date == the session date (prefer final over draft).
- **Always verify**: the PDF's internal `Data: dd/mm/yyyy` header must equal the session date.
  `fetch_sessions.py` does this and auto-re-downloads mismatches.

## Coverage (current mandate, 2023-06 → 2026-05)
- 41 Ple sessions enumerated; **35 actas downloaded + verified** (`data/actas/<code>.txt`).
- 6 gaps, all acceptable for v1: `PLE_05_2026` (too recent, minutes not posted yet),
  `PLE_06_2023` (constitutive/swearing-in — mayor election, different format),
  `PLE_07_2024_EXTR`, `PLE_11_2024`, `PLE_12_2024`, `PLE_4_2025` (drafts not yet found by
  date-match — chase later on the following session's page).

## Reus council composition (current mandate 2023–2027)
27 councillors. The **alcaldessa votes within PSC-CP**. Party-group tokens **as printed in
the actes** (take verbatim — they drift):
| Token(s) in actes | Group | Role |
|---|---|---|
| `PSC-CP` | Partit dels Socialistes | **governs** (mayoralty) |
| `JxR-CM` | Junts per Reus | opposition |
| `ERC-AM` (sometimes `ERC`) | Esquerra Republicana | opposition |
| `CUP` | CUP Amunt | opposition |
| `VOX` | Vox | opposition |
| `PP` | Partit Popular | opposition |
| `A` | small group (councillors Rubio & Vázquez) | — |
| `no_adscrit_<Surname>` | non-attached councillors (e.g. Pardo, Ruiz) | vote **independently** |

- **Coalitions are issue-by-issue, not a fixed bloc** — real contested signal.
- Token drift: `ERC` vs `ERC-AM`, `JxR` vs `JxR-CM`. Normalise at aggregation, extract verbatim.

## Identifying councillors / rolling up to party
- Vote blocks list **each councillor by surname, grouped under their party token**, e.g.
  `25 vots a favor: ((PSC-CP): Guaita, Baiges…; (ERC-AM): Llauradó…) i 2 abstencions: (CUP): Pàmies, Martí`.
- **party_votes = roll-up of councillor_votes**: all of a group's members same vote → that
  vote; if they differ → `split`; if a member left mid-session → `absent` (omit from names).
- Non-attached councillors must be keyed individually by surname (a single `no_adscrit`
  rollup would be wrong — they disagree).
- Edge cases handled: `vota verbalment` = normal oral vote; `S'absenta … el Sr. X` = absent
  for subsequent points; point-by-point motions (`Sotmès el punt X…`) = one row per point;
  a *requested-but-rejected* "votació separada" is still a single row.
- Surname spelling drifts across a doc (e.g. Berasategui/Berasastegui) — normalise to the
  attendance-list form for per-councillor work; party rollup is unaffected.

## Vote-outcome templates (for parsing)
- `Sotmesa la proposta/moció a votació, s'aprova per unanimitat.` → unanimous (counts=false candidate)
- `… s'aproven per assentiment` → by assent (counts=false candidate)
- `… s'aprova amb N vots a favor: (…) i M vots en contra/abstencions: (…)` → approved, possibly divided
- `… es rebutja amb …` / `es desestima` → **rejected** (inherently contested → counts=true)
- A missing category line (no "en contra" line) means **0**, not unknown.
- Watch: Catalan abbreviations `Sr.` `Sra.` `Sres.` `Srs.` embed periods — don't split sentences on ".".

## Corpus shape (survey over the 35–39 sessions, `extract_votes.py`)
~401 vote outcomes: **~284 contested** (≈193 approved-but-divided + ≈91 rejected motions)
vs ~117 effectively-unanimous. Plenty of contested signal — the map won't collapse to a blob.

## Extraction status & schema
- Approach (Rob's call): **LLM extraction per session** (most robust to the prose). Pilot +
  2 diverse sessions extracted and **every tally reconciled exactly** against printed counts.
- Done so far (`data/raw/parsed_<code>.json`): `PLE_03_2026_ORD` (10), `PLE_12_2025_EXTR` (26),
  `PLE_9_2023_ORD` (13) = 49 decisions, spanning 2023→2026, ordinary + extraordinary.
- Per-decision schema (this pass extracts **facts only** — no interpretation):
  `id · point · title · organ · type(proposta/mocio) · proposed_by · outcome(approved/rejected) ·
   decided(unanimous/divided) · tally{for,against,abstain} · party_votes{token→for/against/abstain/split/absent} ·
   councillor_votes[{name,party,vote}] · raw_outcome`
- **NOT in this pass:** `counts` (the contested-filter flag — Phase 2) and `context` (the
  citizen-legible compression — Phase 1, the bias-prone part, needs human review). Kept
  separate on purpose so extraction stays auditable.

## How "context" per decision will be stored (answer to an open question)
Three distinct layers, deliberately separated so we never lose the thread back to the source:
1. **source_url** — link to the acta PDF (have it now). Falsifiability anchor.
2. **raw excerpt** — the decision's full prose block from the acta (and/or its dedicated
   motion PDF from the detail page) stored verbatim as `raw_text`. This is the honest source
   material; cheap to capture in the extraction pass.
3. **compression (Phase 1)** — a short citizen-legible "they're doing X, it costs you Y"
   explanation *derived from* the raw excerpt, generated and **reviewed** before it feeds
   votes. This is the bias-prone layer; it never replaces 1–2, it points back to them.

## Repo layout
```
Riot.md, To Do Riot.md     standing context + plan
docs/FINDINGS.md           this file
scripts/fetch_sessions.py  enumerate sessions → download+verify actas → data/actas/*.txt
scripts/extract_votes.py   regex corpus survey → data/raw/vote_outcomes.json
scripts/build_table.py     merge parsed_*.json → data/decisions.json (+ ./data.js)
data/raw/sessions.json     session index (code, date, detail/acta URLs)
data/raw/parsed_<code>.json  per-session LLM extraction
data/decisions.json        the committed table (one row per decision)
index.html + data.js       the site (GitHub Pages root) — verification viewer for now
```
