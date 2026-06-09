# RIOT — per-item deep-dive → card pipeline (CANONICAL)

How we turn a voted council decision into a card. Adapted from Aleida's vault flows
(Flux 1 transcription + Flux 2 analysis) but **with the political lens stripped**: RIOT's
deep layer is neutral fact, and opinion lives only in the human layers (see `CARD_STYLE.md`).

Run it **one votable item at a time**. Gate first: only items the legal-category taxonomy
(`scripts/taxonomy.py`) marks **votable** get a card — never precs/preguntes/dació de compte.

---

## Stage A — Gather every source for the item (total coverage, nothing discarded)
The acta (minutes) is a *compressed* record. The depth lives in the per-item documents.

- The session detail page (`serveis.reus.cat/actes/session/sessionDetail/<id>`) lists documents
  as `downloadItem/<id>` links with titles. Per item the source set is:
  - the item's **section of the acta** (always), **plus**
  - any **dedicated PDF(s)** attached to it. **Mocions almost always have their own PDF**
    (full text: exposició de motius + every acord verbatim) — richer than the acta's paraphrase.
    Propostes/ordinances often have none on the portal (acta is the only source); heavy
    expedients can attach technical/economic reports + annexes.
- Download each to `data/expedients/<id>_<slug>.pdf`, `pdftotext -layout` → `.txt`. The PDFs are
  re-fetchable (gitignored); keep the transcriptions. **Capture metadata** the source exposes:
  who tabled it (party/àrea), signatory, registre number, date. (Metadata, NOT card copy.)
- Document counts vary wildly (2 → 200). Don't assume one PDF. Open **everything attached to
  the item** before writing a word — never summarise from the title or the acta alone.

## Stage B — Neutral deep-dive (the "expensive analyst", lens OFF)
Cost-indifferent for this pass: it's the extraction tier, done once per item, and everything
downstream hangs off it. Open every gathered doc and synthesise the **neutral `deep` dossier**:

- **Total coverage:** read each document fully; never rank/summarise by title. The cardinal
  error is assigning weight to a doc you haven't opened.
- **Type every figure with provenance.** Tag each number: *atorgat / pressupostat / justificat /
  executat / revocat / reintegrat / estimat*. Most errors are the label, not the number. If you
  can't type it, mark `[confirmar]`.
- **Cite source + page** on every figure/claim: `(moció CUP, p.1)`, `(acta, punt 16)`. This is
  RIOT's falsifiability anchor — the deep must be traceable back to the source.
- **Cheap accelerator:** grep all transcriptions for `€` and expedient refs to build a figure map;
  cross-check the same number across docs for inconsistencies.
- **Multi-round converge (≥3, embedded in one run):** (1) coverage — open all, draft;
  (2) deepening — verify & type figures, chase non-money levers (dates, conditions, scope);
  (3+) completeness critique — audit for any unopened doc / untyped figure / unsourced claim;
  repeat until a pass comes up dry (~2 dry passes max). Converged = stable, not verified.
- **NEVER in the deep prose:** the vote result/outcome (it's a structured field, and a spoiler),
  and **no opinion/lens** — neutral facts only. The deep feeds the AI proxy; it must not inherit
  our slant.

Output is **two separate fields** (both shown in-app under "Anàlisi completa"):
- **`deep_facts`** — the dense, neutral, cited dossier (≈80% of the source doc, total coverage).
  This is the **ONLY deep the AI proxy reads** — it votes from facts + the person's `soul.md`.
- **`deep_lectura`** — the analyst read: what the proposal *enables*, second-order effects, the
  coalition wedge, the unstated/likely-unconscious intentions. **Inference, explicitly labelled
  as such, human-facing ONLY — never fed to the proxy** (else it inherits our read of motives).
  This is the most bias-prone content in the system; it wants Rob's review before it's trusted.

Keeping them as distinct fields is what makes the "AI reads facts only" rule enforceable.

## Stage C — Merge into the human layers (hand off to `CARD_STYLE.md`)
From the **verified** deep, derive the two human-facing layers. The deep is the ground truth;
the human layers are written *from* it, never inventing beyond it.

- **headline** — the concrete proposal being voted, verb-first, direction explicit, a-favor/
  en-contra unambiguous. (Full rules in `CARD_STYLE.md`.)
- **brief** — the "Veure més": what it is + why it's on the table + the real for/against handle,
  opinionated, self-contained, no result, no proposer.
- The opinion/voice lives here; the deep stays neutral. A good deep makes the headline *stable*
  (accurate facts → the title rarely needs to change).

Pipeline files: `deep_<code>.json` (raw neutral dossiers) → `voice_<code>.json` (`{id, headline,
brief, deep}`) → merged into `explained_<code>.json` → `build_table.py` → `decisions.json`/`cities/reus/data.js`.

## What differs from Aleida's vault (on purpose)
- **Lens stripped:** her Flux 2 bakes in the CUP lens; RIOT's deep is neutral. Opinion is quarantined to headline/brief.
- **Per decision, not per session;** gated to **votable** items only (taxonomy), so we never grind the 200-doc noise.
- **Vote results excluded from prose** (blind-vote integrity), kept as structured data.
- We **keep** her best mechanics: total coverage, figure-typing, source+page traceability, multi-round convergence, cost-indifference on the extraction pass.

## Inclusion gate — votability + discretion (auto proposes, human disposes)
Not every votable item earns a card. An item is worth voting on only if a citizen's values
produce a meaningful for/against. Three layers decide what reaches the deck:

1. **Legal-category gate** (`scripts/taxonomy.py`) — only votable categories; drops
   precs/preguntes/dació. Hard, automatic.
2. **Discretion auto-detect** (`scripts/detect_discretion.py` → `data/auto_discretion.json`) —
   PROPOSES dropping low-discretion items (mandated by higher law / pure procedure / symbolic),
   **rescued by observed contestation** (against-share ≥ ~20% → a real values fight, keep it; a
   'no' on a mandate is a symbolic stance, so if nobody cast it, there was no choice). Recall net.
3. **Curator marks** (`data/curator_marks.json`) — the human flags. **Authoritative + ground truth.**

**Auto suggests, you confirm (Rob's call):** auto NEVER hides anything. `build_table.py` sets
`auto_suggest=true` on items auto proposed but **not yet confirmed or dismissed** by the human;
the app surfaces these as "proposem no votar?" for a tap. **Confirm** → the id joins
`curator_marks.json` → hidden from the deck. **Dismiss** → joins `data/curator_dismissed.json` →
stops nagging, stays in the deck. Only `curator_marks.json` ever hides (`curator_drop`). The
human's confirms/dismisses are the **training signal** that tunes the detector's markers and the
contestation threshold — disagreements (e.g. auto firing on "removing an obligation") are the work.

Validated on the first 11 human flags: the detector reproduced all 10 drops and kept the
contested one (escombraries). Small sample — the value is the loop, not a finished classifier.

## Cost
Extraction (Stage A+B) is the budget item — done once per item, worth doing exhaustively.
Copy (Stage C) is cheap and re-runnable freely (reads the compact deep, not the PDFs).
