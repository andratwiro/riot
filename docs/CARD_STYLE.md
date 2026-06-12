# RIOT — card copy rules (CANONICAL)

This is the **single source of truth** for how every decision card is written. It applies
to all sessions, now and as we scale back to 2023. Follow it exactly so we never re-do work.

## Who you're writing for
A **rushed resident of Reus** who knows **nothing** about the topic, has **no time**, and is
about to vote **for / against / abstain** on the item **as if it were happening now**. They
have not seen how the council actually voted. Your job is to make them understand, in seconds,
**why this touches their life** — enough to have an instant gut reaction.

## The three layers (each has a distinct job — they must NOT repeat each other)
1. **headline** — 1–2 short sentences stating the **concrete proposal being voted** — the
   actual thing that gets approved if you vote *a favor*. Plain and understandable on its own,
   so a rushed person grasps what they're deciding without opening "Veure més". Lead with the
   action (the verb): *Aprovar / Apujar / Aturar / Crear / Eliminar / Exigir…* The nuance, the
   "why it matters" and the opinion go in the **brief**, NOT the headline.
2. **brief** (`source_brief`) — short lead paragraph + 2–4 bullets. The de-bureaucratised
   explanation: what it really is, why it's on the table, the real stake or fault line.
   Self-contained and opinionated. The first "Veure més".
3. **deep** — the "Anàlisi completa", in two labelled parts (see `DEEP_DIVE.md`):
   **`deep_facts`** (neutral, cited, ≈80% of the source doc — the ONLY part the GHOST reads)
   and **`deep_lectura`** (analyst inference: what it enables, hidden intentions — human-facing
   only, never fed to the ghost). Both assume the brief was read; facts never re-explain the item.

## HARD RULES (non-negotiable)
- **NEVER state the vote result.** No tallies, no "aprovada/rebutjada/per unanimitat", no
  "X a favor / Y en contra", no "vot sol", no "l'altre punt amb N en contra". The result is a
  spoiler that biases the vote; the app shows it separately. This holds in ALL three layers.
- **NEVER name who presented it in the copy.** "Moció de VOX…", "Junts demana…", "La CUP vol…"
  are **metadata** (stored in `proposed_by`), not copy. Naming the party primes the reader by
  tribe instead of by the issue. Describe the issue and the fault line impersonally
  ("la proposta sobre la taula és…", "el govern s'hi resisteix").
- **HISTORY-DECK ADAPTATION of the rule above (Rob, 2026-06-12, born on the Weimar deck):**
  in a historical instance the reader has no present-day tribe to be primed into, and
  scrubbing the actors deletes the context a modern reader needs — the first Weimar draft
  never said "Hitler" or "Nazi" and was unreadable without a history degree. So: **named
  historical actors are required scene context** (Hitler, the Nazis, the SA, Brüning, Papen,
  Hindenburg; Corbyn-era party names in Commons 2019 stay out per the live rule — 2019 is
  still tribal). Every history-deck brief OPENS with a one-line scene-set: the date and who
  governs ("It is 23 March 1933. Hitler has been Chancellor for seven weeks."). The narrow
  proposer rule still holds (don't frame the headline as "Party X demands…"), and the
  own-result + island rules are untouched: name the world, never the verdict.
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

## Headlines — the two tests
Every headline must pass BOTH:
1. **The vote test:** could a reader vote *a favor* or *en contra* and know what each means? The
   headline must state the concrete proposal as an action. If you can't tell what "a favor"
   approves, it fails.
2. **The direction test:** for anything about money/rules/services, the headline must say which
   WAY it goes — *apujar / congelar / abaixar / eliminar / crear*. Never hide the direction
   behind a neutral "s'actualitza" or a fact dump.

Then keep it plain and self-contained (understandable without "Veure més").

BANNED in headlines:
- **Rhetorical or either/or questions** — "Val la pena?", "Hi seguim o en sortim?",
  "Prioritat o sobredimensionat?". You can't vote a question; state the proposal instead.
- **Tacked-on warnings or asides** — "…i una advertència, …". One clean proposition only.
- **Snark / dangling attitude** — "…deute que pagarem amb anys de quotes". If you add a second
  clause it must be a CONCRETE fact (a figure, a duration, a consequence), e.g. "a tornar en 12 anys".
- **Vibe over substance** — copy so punchy the reader must open the brief to learn what's
  actually being decided. The decision comes first; the angle lives in the brief.
- Proposer names and vote results (see hard rules).

GOOD (action stated, votable, direction explicit) — several are Rob's own rewrites:
- *"Aturar la construcció del pàrquing soterrat de 11 M€ de la Hispània (s'hi ha trobat mercuri i plom al sòl) i reconvertir-lo en parc."*
- *"Sortir de la funerària pública FUNECAMP i deixar d'aportar-hi diners, després que un jutge n'anul·lés la justificació econòmica."*
- *"Aprovar la pujada salarial obligatòria fixada per l'Estat per al personal de Reus Promoció: +2,5% (2025) i +1,5% (2026)."*
- *"Apujar un 2,5% (IPC) la taxa per obtenir documents municipals (empadronament, cèdules) i els drets d'examen d'oposicions."*
- *"Crear un Pacte Local pel català que, entre altres coses, lligaria la llicència d'obertura dels comerços a retolar en català."* (short, clear, votable)

BAD (real misfires we fixed):
- *"…i una advertència, l'Ajuntament a penes executa…"* → second topic glued on; drop it.
- *"…deute que pagarem amb anys de quotes."* → snark; give the actual term (12 anys) or nothing.
- *"Pavelló del Molinet aturat, gespa amb microplàstics… La proposta posa terminis i diners."* → what am I approving? State it: "Exigir dates per al Molinet i canviar la gespa (600.000 €)…".
- *"Hi seguim posant diners o en sortim?"* → unvotable question.

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
