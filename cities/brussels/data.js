// window.RIOT for the Brussels preview. PREVIEW SEED, not the final corpus:
// 4 real decisions from the Brussels-Capital Parliament, votes sourced from the
// public plenary report / press (see source_url). The verified 2026 corpus is
// produced by the FR-CRI pipeline (Track B). Cards are English; raw_outcome is the
// French source line. party_votes_canon uses for/against/abstain like Reus.
window.RIOT = {
  "generated_for": "riot.brussels",
  "preview": true,
  "note": "PREVIEW seed — 4 real Parlement bruxellois decisions (press-sourced votes). Full 2026 corpus via the CRI pipeline.",
  "n_decisions": 4,
  "sessions_in_table": ["PB_2026_05"],
  "parties": [
    {"token": "PS",   "name": "PS",          "color": "#e6002d", "logo": null},
    {"token": "MR",   "name": "MR",          "color": "#1356a0", "logo": null},
    {"token": "ECO",  "name": "Ecolo",       "color": "#66a821", "logo": null},
    {"token": "LE",   "name": "Les Engagés", "color": "#00a99d", "logo": null},
    {"token": "PTB",  "name": "PTB",         "color": "#9b0014", "logo": null},
    {"token": "DEFI", "name": "DéFI",        "color": "#e6007e", "logo": null},
    {"token": "NVA",  "name": "N-VA",        "color": "#f0a500", "logo": null},
    {"token": "GRN",  "name": "Groen",       "color": "#8cc63f", "logo": null}
  ],
  "decisions": [
    {
      "id": "PB_2026_05-p1",
      "date": "2026-05-15",
      "session_code": "PB_2026_05",
      "point": 1,
      "organ": "Parlement bruxellois",
      "type": "Ordonnance",
      "topic": "Cost of living",
      "headline": "Raise service-voucher prices and home-help wages",
      "title": "Proposition modifiant l'ordonnance relative aux titres-services (prix et conditions de travail)",
      "source_brief": "Parliament raised the price of service vouchers (titres-services) — €11.40 for the first 300, €14 for the next 200 — and granted home-help workers a €0.77/hour raise from January 2026. The tax break on vouchers ends in 2027.",
      "stake": "Who absorbs the rising cost of subsidised home help — users, workers, or the regional budget.",
      "raw_outcome": "Adopté. Le MR a voté contre (« choc tarifaire », risque de marché noir) ; la N-VA s'est abstenue ; le reste a soutenu.",
      "outcome": "approved",
      "source_url": "https://bx1.be/categories/news/derniere-seance-pleniere-au-parlement-bruxellois-voici-ce-qui-a-ete-vote/",
      "party_votes_canon": {"PS": "for", "ECO": "for", "GRN": "for", "DEFI": "for", "MR": "against", "NVA": "abstain"}
    },
    {
      "id": "PB_2026_05-p2",
      "date": "2026-05-15",
      "session_code": "PB_2026_05",
      "point": 2,
      "organ": "Parlement bruxellois",
      "type": "Proposition de résolution",
      "topic": "Culture",
      "headline": "Secure permanent funding for the Zinneke Parade",
      "title": "Proposition de résolution visant à pérenniser le financement structurel de la Zinneke Parade",
      "source_brief": "A resolution asking the government to anchor structural funding (€0.35–0.40M, ~35–40% of the non-profit's budget) for the Zinneke Parade, whose support is at risk while no regional government is formed.",
      "stake": "Whether a flagship participatory cultural event gets stable public money or lives grant-to-grant.",
      "raw_outcome": "Adoptée. Le MR a voté contre (raisons budgétaires) ; la N-VA et l'Open VLD se sont abstenus ; le reste a soutenu.",
      "outcome": "approved",
      "source_url": "https://bx1.be/categories/news/derniere-seance-pleniere-au-parlement-bruxellois-voici-ce-qui-a-ete-vote/",
      "party_votes_canon": {"PS": "for", "ECO": "for", "GRN": "for", "DEFI": "for", "LE": "for", "PTB": "for", "MR": "against", "NVA": "abstain"}
    },
    {
      "id": "PB_2026_05-p3",
      "date": "2026-05-15",
      "session_code": "PB_2026_05",
      "point": 3,
      "organ": "Parlement bruxellois",
      "type": "Proposition de résolution",
      "topic": "Rights & safety",
      "headline": "Adopt a plan against anti-LGBTQIA+ violence",
      "title": "Proposition de résolution relative à la prévention des violences anti-LGBTQIA+",
      "source_brief": "A resolution requesting a prevention plan against anti-LGBTQIA+ violence, including police training and victim-support protocols. Adopted unanimously.",
      "stake": "Putting a concrete public-safety obligation behind a stated value.",
      "raw_outcome": "Adoptée à l'unanimité.",
      "outcome": "approved",
      "source_url": "https://bx1.be/categories/news/derniere-seance-pleniere-au-parlement-bruxellois-voici-ce-qui-a-ete-vote/",
      "party_votes_canon": {"PS": "for", "MR": "for", "ECO": "for", "LE": "for", "PTB": "for", "DEFI": "for", "NVA": "for", "GRN": "for"}
    },
    {
      "id": "PB_2026_05-p4",
      "date": "2026-05-15",
      "session_code": "PB_2026_05",
      "point": 4,
      "organ": "Parlement bruxellois",
      "type": "Ajustement budgétaire",
      "topic": "Budget",
      "headline": "Approve a fifth round of provisional 'budget twelfths'",
      "title": "Douzièmes provisoires — cinquième tranche",
      "source_brief": "With no Brussels government formed since the June 2024 elections, Parliament approved a fifth tranche of provisional budget 'twelfths' so regional services keep running. (Per-group split not individually recorded in the seed — the pipeline will fill it.)",
      "stake": "Keeping the Region funded during a record-long government formation.",
      "raw_outcome": "Adopté (gestion des affaires courantes).",
      "outcome": "approved",
      "source_url": "https://bx1.be/categories/news/derniere-seance-pleniere-au-parlement-bruxellois-voici-ce-qui-a-ete-vote/"
    }
  ]
};
