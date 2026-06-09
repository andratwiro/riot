// Per-city config for the RIOT viewer. Loaded before data.js/ai_votes.js by the
// `?city=` loader in index.html. Card content language lives in the data itself;
// this only drives chrome (title, brand, document lang) and a few tunables.
window.CITY_CONFIG = {
  id: "reus",
  name: "Reus",
  title: "REUS",
  lang: "ca",                          // Reus cards stay in Catalan (source language)
  logo: "assets/logos/reus_rose_color.svg",
  live_split: true,                    // after-vote room split (only renders post-vote)
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
