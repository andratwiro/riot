# RIOT Germany — researched candidates (2026-06-12)

Brief: a German, current instance with a juicy, recent 10-card demo deck. Cards need not share
a plenary session. Two venues researched: the Bundestag (national) and the Berlin
Abgeordnetenhaus (Land). All data claims source-verified 2026-06-12; flags noted inline.

## Verdict: Bundestag. Phase-0 clears twice over.

The 21st Bundestag (Merz CDU/CSU+SPD coalition, since March 2025) has held **56 namentliche
Abstimmungen** so far, 17 of them in Jan–Jun 2026. Two independent machine-readable per-MP
sources, both verified end-to-end (file downloaded, parsed, tallied, cross-checked):

- **Official XLSX per vote** at bundestag.de: every roll call ships a PDF facsimile AND an XLSX
  with 630 MP rows (Fraktion, Name, ja/nein/Enthaltung/nichtabgegeben). Example parsed:
  `bundestag.de/resource/blob/1184014/20260611_2_xls.xlsx` (EUFOR ALTHEA, 11.06.2026,
  tallied 386–193–3, matches published outcome exactly). List scrapable via the AJAX fragment
  `bundestag.de/ajax/filterlist/de/parlament/plenum/abstimmung/liste/462112-462112?limit=30&offset=N`.
  Files appear same-day-ish.
- **abgeordnetenwatch.de API v2** (JSON, no key, CC0): legislature id 161 = "Bundestag
  2025–2029". `api/v2/polls?field_legislature=161` lists all 56; `api/v2/votes?poll=<id>`
  returns all 630 per-MP votes. Could power the instance alone; the official XLSX is the
  natural raw-data verification layer (verify-then-author, as ZA/TN).
- DIP API exists (`search.dip.bundestag.de/api/v1`, free key required) but has NO per-MP
  roll-call entity: useful for Drucksache texts and procedure metadata only.

Chamber: 630 MPs. Fraktionen CDU/CSU (~208), SPD (~120), AfD (~151), B'90/Grüne (~85),
Die Linke (~64), fraktionslos. Seat counts approximate (derived from XLSX tallies).

## Proposed 10-card demo deck (recent, mixed sessions)

Margins below from bundestag.de textarchiv [bt] or a single abgeordnetenwatch list fetch [aw];
one [aw] margin (EUFOR) was independently re-derived from the official XLSX and matched exactly.
**Recompute every margin from the XLSX during the build**; that is the pipeline anyway.

1. **Wehrdienst-Modernisierungsgesetz** — 05.12.2025, PASSED 323–272 [bt]. New voluntary
   military service; questionnaire to every 18-year-old from 2026. The tightest big one.
2. **Rentenpaket (Rentenniveau + Kindererziehungszeiten)** — 05.12.2025, passed with only 7
   Union dissenters after the young-MPs rebellion. The term's best coalition-discipline story.
3. **Mietwuchergesetz** — 06.11.2025. The excessive-rent fight; rhymes with the housing cards
   in Reus and Brussels.
4. **GEAS-Anpassungsgesetz** — 27.02.2026, PASSED 309–260 [bt]. National implementation of the
   EU asylum reform; opposed from both flanks (AfD and Grüne+Linke voted no). Great card.
5. **Bürgergeld → neue Grundsicherung** — 05.03.2026, PASSED 320–268 [bt]. The flagship
   welfare-reform fight.
6. **Energy tax cut on fuels** — 24.04.2026, PASSED 451–134 [aw]. Pump-price relief;
   maximally relatable.
7. **Stromsteuer bill (Grüne)** — 24.04.2026, REJECTED 270–310 [aw]. The closest 2026
   division found.
8. **BAföG reform motion** — 11.06.2026, killed 442–141 [aw]. Live coalition tension: SPD MPs
   publicly pushing for the rise that the recommendation buried.
9. **Jahresemissionsgesamtmengen-Verordnung 2031–2040** — 11.06.2026, PASSED 303–188 [aw].
   The 2026 climate vote: national emission caps for the next decade.
10. **§188 StGB Streichung (Politikerbeleidigung)** — 29.01.2026, REJECTED 133–440 [bt].
    AfD bill to scrap the insulting-politicians offence; framing is speech vs. protection of
    office-holders, all other Fraktionen opposed.

Alternates: Bundeswehr anti-IS Iraq extension (29.01.2026, 389–187, Grüne with the coalition),
KFOR Kosovo (11.06.2026, 382–192), Haushaltsgesetz 2026 final vote (28.11.2025), windfall-profits
tax killed (24.04.2026, 449–136), Pendlerpauschale killed (24.04.2026, 448–136).

Topic spread of the ten: conscription, pensions, rent, asylum, welfare, fuel tax, electricity
tax, students, climate, speech. Seven of ten from 2026.

## Flags

- **No AfD-ban roll call.** Motions exist (113 cross-party MPs; 43 Grüne for a feasibility
  review) but NO namentliche Abstimmung appears in the official 56-vote list. One search
  summary claimed a "Feb 4, 2026 rejection": unverified and contradicted by the official list.
  Do not card without a primary source.
- bundestag.de HTML list titles carry occasional typos ("08.05.20626"); trust the XLSX
  contents (Sitzungnr, date), not the titles.
- No 2026 roll calls on Mindestlohn (commission, not plenary) or pensions (that vote was
  05.12.2025).

## Berlin Abgeordnetenhaus: timely hook, no per-member data

- Election confirmed **Sunday 20 September 2026** (20th AGH + the twelve BVVs; Senate decision
  03.06.2025). The "term now ending" hook is real.
- But the gate fails for per-member: roll calls happen only when a Fraktion demands one, and
  the whole term yields roughly TWO since the Feb 2023 court-ordered re-run: the €3bn
  Nachtragshaushalt cuts (19.12.2024, 83–69, the term's most dramatic vote) and the
  Ausbildungsförderungsfonds training levy (26.03.2026, 128–16, CDU yes "under protest").
  Telling negative: the Vergesellschaftungsrahmengesetz (12.03.2026), the term's most salient
  law, passed by show-of-hands with no per-member record.
- Official open data is XML metadata only (PARDOK); vote outcomes live in protocol PDFs.
  abgeordnetenwatch's API covers the roll calls (verified: poll 6015 returns all 161 member
  votes) but only those.
- Berlin would work only on the Reus-style hand-curated per-party model (10–16 salient
  decisions are findable, incl. Vergesellschaftung, Doppelhaushalt 26/27, Verwaltungsreform
  with the rare cross-bloc 2/3 majority), with the two roll calls as per-member showpieces.
  Park it; revisit as a September election-week deck if wanted.
- Flags: WP19 roll-call count is sampling-based, not exhaustive (true number could be slightly
  above 2); per-Fraktion phrasing consistency across Beschlussprotokolle not sample-parsed.

## Key sources

- https://www.bundestag.de/parlament/plenum/abstimmung/liste (and /liste/2026)
- https://www.abgeordnetenwatch.de/api/v2/polls?field_legislature=161 (CC0)
- https://www.abgeordnetenwatch.de/bundestag/21/abstimmungen
- Vote reports: bundestag.de/dokumente/textarchiv/2026/kw09-de-geas-1149762 (GEAS),
  kw10-de-grundsicherung-1150460, kw05-de-strafgesetzbuch-1139542, kw05-de-bundeswehr-irak-1136956,
  2025/kw49-de-wehrdienst-1128220
- Berlin: https://www.berlin.de/wahlen/wahlen/berliner-wahlen-2026/ ,
  https://www.parlament-berlin.de/dokumente/open-data ,
  https://www.abgeordnetenwatch.de/berlin/abstimmungen
