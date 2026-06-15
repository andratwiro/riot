# RIOT history decks — researched candidates (2026-06-12)

Candidates for the "civic memory" weekly series in Go Vocal: one historical process per week,
replayed as a RIOT deck — you vote blind, then see what the real body decided. Seeded by the
era-stamp convention (Tunisia 14–18: historical decks wear their years).

What makes a moment RIOT-able: a **deck of discrete recorded decisions** (roll calls, ballot
questions, assembly recommendations) with published outcomes at some granularity
(per-member > per-party > aggregate %). All data claims below were source-verified 2026-06-12.

## Tier 1 — build-ready (data verified, strong story)

### UK Commons: the Brexit indicative votes (2019) — fit 5/5
"Parliament couldn't agree on anything." 27 Mar 2019: 8 ways out of Brexit, all fail
(customs union loses by 3, 265–271). 1 Apr: 4 more, all fail. Plus the three Meaningful
Votes (MV1 202–432 — largest government defeat ever). ~12–15 cards.
**Data:** per-MP JSON, today, free — `commonsvotes-api.parliament.uk/data/division/{id}.json`
(indicative-vote divisions 655–662 and 666–669; verified per-MP with party + constituency).
Party lines shattered (free votes) — the compare view would show parties split, which is the point.
Design note: every card fails, so the reveal is "you vs the chamber's split", not "did you match
the outcome".

### Chile: Constitutional Convention 2021–22 — fit 5/5
155 elected citizens (gender parity, 17 indigenous seats) rewrite Pinochet's constitution
article by article — then the country rejects the whole text 62–38 in the exit plebiscite.
A dead chamber: "Chile 21–22", sibling to Tunisia 14–18.
**Data:** Harvard Dataverse roll-call dataset (Bunker/Toro/Contreras, doi:10.7910/DVN/JLTSRL) —
**4,669 per-member roll calls, CC0**, with codebook. Same pipeline shape as Congress/SA.
Curate ~30–60 landmark articles (nature as subject of rights, plurinational state, abolish the
Senate, water). Spanish; bloc mapping needs the codebook.

### Ireland: Citizens' Assembly → Eighth Amendment referendum (2016–18) — fit 5/5
99 randomly-selected citizens break a 35-year deadlock on abortion by secret ballot; the country
then confirms 66.4% Yes. The Assembly's ballots are published per question with exact counts —
13 items on the Eighth Amendment weekend alone, ~45–50 across all five topics (incl. a 36–35
nail-biter on fixed-term parliaments).
**Data:** citizensassembly.ie final-report PDFs (tallies per ballot); 2018 referendum
per-constituency (Donegal the only No). Ballots were secret → **no members/parties**: the reveal
is % bars + the referendum kicker. Would need a "percentage reveal" mode — RIOT's first
party-less chamber.

### Weimar: the Reichstag dies (1930–33) — fit 4/5
The one I'd mentioned. A democracy votes itself to death in ~10–15 cards: Young Plan → SPD
tolerating Brüning's decree regime → 12 Sep 1932, Nazis and Communists vote *together* to bring
down Papen 512–42 → 23 Mar 1933, the Enabling Act 444–94, only the SPD opposed, the KPD already
arrested. Era stamp: "Reichstag 1930–33".
**Data:** full stenographic protocols digitized (reichstagsprotokolle.de) but as Fraktur page
scans — no machine-readable roll-call dataset for 1919–33. Per-party positions are rock-solid in
the literature; cards would be hand-authored per-party (Tunisia-style bloc display), verified
against protocol scans. Many key moments were decrees, not votes — selection needs care.

### Switzerland: the people as the chamber (1848–present) — fit 5/5 on data
700+ federal votes, every one in a single CC-BY CSV (swissvotes.ch) **including party
recommendations per vote** — the only referendum source where RIOT can show party positions
natively. Curate ~20–30 landmarks: women's suffrage REJECTED 1959 then passed 1971, EEA 1992,
minaret ban 2009, basic income 2016. Per-canton splits via opendata.swiss / swissdd.
Lower drama-per-card than the others; best as the format-proof referendum instance.

## Tier 2 — strong, with one catch each

### Taiwan, 24 Nov 2018: ten questions, one day — fit 5/5 shape, aggregate only
A natural one-sitting deck of exactly 10 cards — and the country approves an anti-marriage-
equality measure (Q10, 72.5%) and protection for same-sex couples (Q12, 61.1%) on the same
afternoon. Results verified per question (CEC via Wikipedia table / rfrd-tw.github.io).
Pairs thematically with vTaiwan. Catch: CEC sub-national data is Chinese, form-driven.

### vTaiwan: the UberX Pol.is consultation (2015) — fit 4/5
4,000+ citizens agree/disagree on ~196 statements until consensus; government adopts the result.
**The most format-native candidate**: github.com/compdemocracy/openData (`vtaiwan.uberx`) has
per-statement agree/disagree counts AND the full participant×statement matrix (CC-BY) — RIOT
could compute *real* opinion clusters for the map. Catches: statements in Traditional Chinese;
only the UberX case has verified raw data; no parties/members to reveal against. (Same repo has
brexit-consensus, austria-climate, 15-per-hour-seattle — a whole Pol.is family.)

### East German Volkskammer, 1990 — fit 4/5
The GDR's only freely elected parliament existed seven months and voted its country out of
existence — the 23 Aug 1990 accession vote (294–62–7) was recorded *by name*, 2:47 a.m.
~10 cards (currency union, Stasi files, unification treaty). Perfect dead-chamber sibling
("Volkskammer 1990"). German protocols, not all votes by name.

### France: the trial of Louis XVI (Jan 1793) — fit 4/5, but 4 cards
The most dramatic roll call ever recorded: ~720 deputies vote aloud, one by one, on four
questions — guilt, popular ratification, the penalty (death by the narrowest margin), reprieve.
Full per-deputy record survives (Archives parlementaires; fr.wikipedia "Votes sur la mort de
Louis XVI" has the complete nominal table). Too short for a deck — but a natural **single
historic sitting** for the live machine. Blocs (Montagne/Gironde/Plaine) are editorial.

### Australia: the referendum graveyard (1906–2023) — fit 5/5 on data
45 questions, only 8 ever passed. The 1967 Aboriginal referendum's 90.77% yes vs the 1999
republic and 2023 Voice failures. Double-majority rule (3 referendums won the people but lost
the states) is a built-in teaching beat. AEC official per-state tables; 2023 to CSV.

### Ireland the long arc: referendums 1937–2024 — fit 5/5 on data
Divorce rejected 1986, passed 1995 by 9,114 votes; abortion banned by referendum 1983,
un-banned 2018; marriage equality by popular vote 2015. The repeat-question pairs enable a
unique mechanic: vote once, reveal both eras. Official per-constituency PDF (referendum.ie).
Could merge with the Citizens' Assembly deck into one Ireland instance.

### UN General Assembly founding votes (1946–50) — fit 4/5
The world's nations as a single chamber: Partition Plan 33–13–10, UDHR 48–0–8, per-country roll
calls in the UN Digital Library. The opinion map becomes literal geography; Cold-War blocs as
caucuses (Congress floor-caucus convention). Scraping needs MARCXML (site bot-blocks fetches);
Res 181 copy needs extreme neutrality.

## Tier 3 — story > data (thin or no deck)

- **Iceland 2010–13** (crisis constitution): the famous part — the crowdsourced Constitutional
  Council — produced **no per-article votes** (final bill passed 25–0 by consensus). What's left:
  the 2012 referendum's 6 questions + 2 Icesave referendums ≈ 8 cards. A story, not a deck;
  works as a mini-act or a "referendums of the crisis" special, not an instance.
- **South Africa 1992–96 prequel**: ~3 votable moments, mostly near-unanimous (1996 Constitution
  421–2), tricameral-era Hansard not digitized. Better as 2–3 prologue cards in the existing SA
  instance.
- **France: Convention Citoyenne pour le Climat** (2020): 149 proposals with published vote %,
  but nearly all ~95%+ yes — no blind-vote tension. The **fin-de-vie convention (2023)** has real
  splits (assisted dying 75.6%; conditions 37/35/28) — the better French assembly deck.
- **Spain 1977–78 transition**: digitized Diario de Sesiones, great arc (incl. the Francoist
  Cortes' own 425–59 hara-kiri vote in 1976), but most votes consensual by design.
- **NZ referendums**: good data, but the multi-option ballots (5 flags, 5 electoral systems)
  fight RIOT's three verbs.
- **Italy 1946/1974/1981**: great maps (the 1946 north/south split), but abrogative referendums
  invert polarity ("yes = repeal divorce") — copy hazard.
- Rejected outright: G1000 Belgium and Ostbelgien (no per-item tallies), India's Constituent
  Assembly (voice votes), 1991 Soviet endgame (no accessible per-member records),
  Oregon CIR (clean but tiny, PDF archaeology).

## Suggested first six weeks (Go Vocal series)

Alternating shape so the series doesn't feel samey — parliament / assembly / referendum:

1. **Brexit indicative votes** — instant build (JSON API), everyone remembers it, nobody
   remembers how *their* MP voted.
2. **Ireland: the Citizens' Assembly + the referendum** — the Go Vocal-est story there is:
   ordinary citizens, structured deliberation, real constitutional change.
3. **Weimar: the Reichstag dies** — the heavyweight; the one history lesson the format was
   born for.
4. **Chile 21–22** — the cautionary mirror to Ireland: a participatory process the people
   rejected.
5. **Taiwan's ten-question day** (+ vTaiwan as the digital-democracy companion story).
6. **The Volkskammer's last year** — a parliament votes its country away.

Then Switzerland/Australia/Ireland-long-arc as the evergreen referendum well.

## Source index (verified)

- CommonsVotes API: https://commonsvotes-api.parliament.uk/data/division/661.json
- Chile roll calls (CC0): https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/JLTSRL
- Irish Citizens' Assembly reports: https://citizensassembly.ie/reports/
- Reichstag protocols: https://www.reichstagsprotokolle.de/
- Swissvotes dataset (CC-BY, incl. party Parolen): https://swissvotes.ch/page/dataset
- Pol.is open data (vTaiwan UberX et al., CC-BY): https://github.com/compdemocracy/openData
- Taiwan 2018 CEC db: https://db.cec.gov.tw/Referendum · English: https://rfrd-tw.github.io/en/
- Volkskammer accession vote: https://www.bundestag.de/dokumente/textarchiv/1990-08-23-volkskammer-ddr-beitritt-202398
- Louis XVI nominal table: https://fr.wikipedia.org/wiki/Votes_sur_la_mort_de_Louis_XVI
- UN voting data: https://digitallibrary.un.org/collection/Voting%20Data
- AEC referendum results: https://www.aec.gov.au/elections/referendums/referendum_dates_and_results.htm
- Irish referendums 1937–2024: https://www.referendum.ie/previous-referendums/index.html
- Italy historical referendums: https://elezionistorico.interno.gov.it/
- NZ: https://electionresults.govt.nz/ · Iceland 2012: https://en.wikipedia.org/wiki/2012_Icelandic_constitutional_referendum
