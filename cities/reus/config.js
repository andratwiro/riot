// Per-city config for the RIOT viewer. Loaded before data.js/ai_votes.js by the
// `?city=` loader in index.html. Card content language lives in the data itself;
// this only drives chrome (title, brand, document lang) and a few tunables.
window.CITY_CONFIG = {
  id: "reus",
  name: "Reus",
  title: "REUS",
  lang: "ca",                          // Reus cards stay in Catalan (source language)
  srcLang: "ca",                       // original proposal wording is also Catalan
  logo: "assets/logos/reus_rose_color.svg",
  chamber: "the council",                 // live-session copy: "the room v. ..."
  live_split: true,                    // after-vote room split (only renders post-vote)
  // LIVE SESSION lobby — every visible string on the gathering screen comes from
  // here (no copy conditionals in live.js). {period} and {n} in docketCountLine
  // are computed from the active deck's metadata at render time.
  lobby: {
    eyebrow: "SESSIÓ EN DIRECTE · REUS",
    headline: "El ple s'està reunint.",
    body: "T'hem reservat un seient al Ple de l'Ajuntament de Reus. Les decisions són reals, extretes de sessions plenàries reals. Els regidors electes ja han votat cadascuna d'elles. Votaràs el mateix ordre del dia, a cegues, i després veuràs en què tu i ells us separeu.",
    docketInstitutionLine: "PLE DE L'AJUNTAMENT DE REUS",
    docketCountLine: "SESSIONS PLENÀRIES {period} · {n} DECISIONS A L'ORDRE DEL DIA",
    statusWaiting: "esperant que s'obri la sessió",
    privacyLine: "Els teus vots es queden en aquest telèfon. La sala només veu recomptes.",
    disclosure: "Decisions seleccionades de l'acta del ple.",
    sittingOpenedFormula: "S'obre la sessió."
  },
  // The DEMO deck — pinned first in the moderator's session picker ("the curated
  // showcase deck"). Hand-picked for a live demo: the cards a citizen actually leans
  // into — vivid, surprising or genuinely divisive — not the most evenly-split votes.
  // Ordered as a run: grabber → light laughs → public-money eyebrow-raisers → the
  // identity/rights flashpoints last, to close strong.
  demo_deck: [
    "PLE_10_2025_ORD-p11",  // 16 people lived a month and a half in the hospital car park
    "PLE_10_2025_ORD-p8",   // the waste ordinance that rules where dogs can (and can't) pee
    "PLE_08_2025_ORD-p12",  // free tampons & pads in municipal buildings and at city events
    "PLE_9_2023_ORD-p13",   // scrap 6 parking spots so a new Mercadona fits its lifts
    "PLE_9_2023_ORD-p5",    // a new mayor's-office confidence job, up to 56,408€/year
    "PLE_2_2026_ORD-p6",    // 22,700 m² of public land to a private art foundation, 50yr, no tender
    "PLE_9_2023_ORD-p16",   // the "cursed" 11M€ Hispània car park — mercury & lead in the soil
    "PLE_9_2023_ORD-p14",   // tie a shop's opening licence to Catalan signage
    "PLE_11_2025_ORD-p12",  // a registry of police ID-checks to detect racist bias (rejected)
    "PLE_08_2025_ORD-p11"   // Vox: scrap the Morocco-funded Arabic program in 5 schools (rejected)
  ],
  // ?deck=live → this curated room-session deck (~15-20 contested cards; the whole
  // room gets the same SET, order is per-person). Curator-picked for variety from
  // the most evenly split for-vs-against votes; the full deck remains the default.
  live_deck: [
    "PLE_04_2026_ORD-p10",   // limit heavy-truck traffic, c/ Pintor Fuster (4F/4A)
    "PLE_03_2026_ORD-p14",   // keep solar-panel tax rebates already granted (4F/4A)
    "PLE_12_2025_EXTR-p20",  // raise cemetery fees by CPI (3F/3A)
    "PLE_12_2025_EXTR-p19",  // public bike-share pricing (3F/3A)
    "PLE_12_2025_EXTR-p16",  // commercial waste-collection price (3F/3A)
    "PLE_12_2025_EXTR-p13",  // terrace/scaffolding street-occupation tax (3F/3A)
    "PLE_12_2025_EXTR-p12",  // driveway (gual) tax (3F/3A)
    "PLE_2_2026_ORD-p11",    // neighbourhood-state reports + brigades plan (5F/4A)
    "PLE_2_2026_ORD-p10",    // empty-shops action plan (4F/3A)
    "PLE_12_2025_EXTR-p2",   // keep 50% IBI surcharge on empty flats (4F/3A)
    "PLE_12_2025_EXTR-p17",  // water/sewage price rise (4F/3A)
    "PLE_12_2025_EXTR-p9",   // municipal-documents fee rise, CPI (4F/3A)
    "PLE_04_2026_ORD-p4",    // 3.81M€ budget modification 23/2026 (3F/2A)
    "PLE_12_2025_EXTR-p22",  // redirect business-creation subsidies (3F/2A)
    "PLE_12_2025_EXTR-p18",  // keep urban bus at 1.50€, free under-14s (3F/2A)
    "PLE_12_2025_EXTR-p14"   // municipal-hall rental & civil-wedding prices (3F/2A)
  ]
};
