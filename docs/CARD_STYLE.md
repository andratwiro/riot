# RIOT — card copy rules (CANONICAL)

This is the **single source of truth** for how every decision card is written. It applies
to all sessions, now and as we scale back to 2023. Follow it exactly so we never re-do work.

## Who you're writing for
A **rushed resident of Reus** who knows **nothing** about the topic, has **no time**, and is
about to vote **for / against / abstain** on the item **as if it were happening now**. They
have not seen how the council actually voted. Your job is to make them understand, in seconds,
**why this touches their life** — enough to have an instant gut reaction.

## The three layers (each has a distinct job — they must NOT repeat each other)
1. **headline** — 1–2 short sentences. Answers **"why should I, a person from Reus, care?"**
   and triggers an immediate for/against reaction. Opinionated, catchy, plain. NOT a neutral
   description of the agenda item.
2. **brief** (`source_brief`) — short lead paragraph + 2–4 bullets. The de-bureaucratised
   explanation: what it really is, why it's on the table, the real stake or fault line.
   Self-contained and opinionated. The first "Veure més".
3. **deep** — the "Anàlisi completa". **Assumes the brief was just read** — adds ONLY new,
   granular facts (€/% figures, legal articles, conditions, technical specs, the motion's full
   demands). Neutral/factual tone. Never re-explains the item. If little to add, keep it short.

## HARD RULES (non-negotiable)
- **NEVER state the vote result.** No tallies, no "aprovada/rebutjada/per unanimitat", no
  "X a favor / Y en contra", no "vot sol", no "l'altre punt amb N en contra". The result is a
  spoiler that biases the vote; the app shows it separately. This holds in ALL three layers.
- **NEVER name who presented it in the copy.** "Moció de VOX…", "Junts demana…", "La CUP vol…"
  are **metadata** (stored in `proposed_by`), not copy. Naming the party primes the reader by
  tribe instead of by the issue. Describe the issue and the fault line impersonally
  ("la proposta sobre la taula és…", "el govern s'hi resisteix").
- **Opinion lives in headline + brief only.** `deep` stays factual and neutral — it's what an
  AI proxy reads to vote, so it must not inherit our slant.
- **"Opinionated" = blunt and clarifying**, never partisan. Cut the bullshit, name the real
  stake, call out pure tràmit. NEVER say a party is good or bad.
- **Facts only**, taken from the neutral dossier (`deep_<code>.json`). Invent nothing; figures
  verbatim. **Catalan**, plain and alive.
- **No generic call-to-action filler** ("Decidiu el paquet", "Decidiu si s'actualitza"). Lead
  with the stake itself.
- **Each card is an island.** Cards are shown in RANDOM order; the reader may see this one
  first and never see the others. NEVER reference another card, point number or sequence
  ("un de quatre punts idèntics", "i el quart calc", "l'altre punt", "com hem vist", "(23-26)").
  State scope without ordinals/counts ("la mateixa pujada arriba a tot el personal municipal").
- **Equip the reader to take a side — this is the whole point.** Every card, even a dull tax
  update, must hand the reader a reason to lean **for or against**: the trade-off, who wins and
  who loses, the principle at stake. NEVER dismiss an item ("…i prou", "tràmit i res més",
  "actualització i ja"). If it looks trivial, find the real tension: *should fees rise on
  autopilot every year? should a public licence be a tradeable asset worth 1.400 €? who pays?*
  If you can't give the reader a handle to push one way or the other, the card has failed.
- **The result does not help anyone vote** — telling them "unanimitat" or who won only biases
  the blind vote. This is why vote outcomes are banned (see above), restated because it slips.

## Headlines — the why-should-I-care test
Every headline must pass: *"Would a busy person from Reus feel this touches them?"* Find the
hook: **what it costs them, what changes in their street/wallet/rights, what's really at play.**

GOOD (hooks the reader, no proposer, no result):
- *"Si tens un bar, botiga o taller, pagues a part per la teva brossa — i el rebut depèn dels metres del local, no del que generes."*
- *"Reus paga una funerària pública que un jutge acaba de tombar. Hi seguim posant diners o en sortim?"*
- *"Apugen el sou als treballadors de l'Ajuntament amb els teus impostos — i Reus no hi pot fer res, ho mana Madrid."*

BAD (rewrite these patterns):
- *"…L'altre punt amb 10 vots en contra."* → states the result.
- *"Moció de VOX per…"* / *"La CUP vol…"* → names the proposer.
- *"La taxa per entrar vehicles als guals s'actualitza. Decidiu si…"* → no hook, generic CTA, why care?
- *"Aprovació definitiva de la modificació de l'Ordenança…"* → bureaucratic, dead.

## Gold standard (full triple)
**headline:** Apugen el sou als treballadors de l'Ajuntament amb els teus impostos — i Reus no hi pot fer res, ho mana Madrid.
**brief:** L'Estat ha apujat el sou a **tot** el sector públic (+2,5% el 2025, +1,5% el 2026) i l'Ajuntament està **obligat** a aplicar-ho; aquí, al personal de Reus Promoció. Reus no decideix ni el quant ni el si: només firma.

- **Surt de la caixa municipal** — és a dir, dels teus impostos.
- És **un de quatre punts idèntics**: el mateix per a l'Ajuntament, Reus Cultura i Mas Carandell.
- **El fons:** el sou dels empleats públics es decideix a Madrid, no a la plaça del Mercadal.

**deep:** (assumes the brief; adds only granularity, neutral, no result)
- Pactat a la **Mesa General de Negociació del 12 de desembre de 2025**.
- Possible **+0,5% addicional i consolidable el 2027** si l'IPC de 2026 ≥ 1,5%.
- **Preu/punt de la RLT:** 20,66 € (2025) → 20,97 € (2026).
- **Retribució anual a Reus Promoció:** director/a 20.216,28 €; informador/a turístic 8.780,52 €.
- Les **despeses d'acció social** queden congelades respecte del 2024.

## Metadata (NOT copy — lives in data, the app may show it, ideally after voting)
`proposed_by` (who tabled it), the vote result (`outcome`, `tally`, `party_votes`,
`councillor_votes`), `legal_category`, `date`, `source_url`. None of this belongs in the
headline/brief/deep text.

## Pipeline (so this is reproducible per session)
1. **Neutral facts** → `data/raw/deep_<code>.json` (extraction subagent reads the acta
   DESENVOLUPAMENT section; includes everything, even tallies, as raw material).
2. **Copy** → `data/raw/voice_<code>.json` = `{id, headline, brief, deep}` written to THIS spec.
3. **Merge** into `data/raw/explained_<code>.json` (keeps `topic`); `build_table.py` emits
   `headline`, `source_brief`, `deep`.
4. The `deep` shown in-app is the curated, brief-assuming version — NOT the raw dossier.

See also [docs/FINDINGS.md] (legal-category votability gate) and `scripts/taxonomy.py`.
