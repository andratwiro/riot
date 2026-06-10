// Brussels instance config. Real data: 2025-2026 Brussels-Capital Parliament roll-call
// (nominal) votes parsed from the plenary CRIs and aggregated to political groups.
// Front-end English; raw source text French. Built by scripts/*_bxl.py.
window.CITY_CONFIG = {
  id: "brussels",
  name: "Brussels",
  title: "BRUSSELS",
  lang: "en",
  srcLang: "fr",                       // original proposal wording (CRI source) is French
  logo: "assets/logos/brussels_iris.svg",
  live_split: true,                    // after-vote room split (only renders post-vote)
  // ?deck=live → curated room-session deck (~15 contested cards; same SET for the
  // whole room, per-person order). The two procedural fast-track votes are excluded.
  live_deck: [
    "BXL-2425-00008-v13",      // cut ministers' cabinet budgets (6F/6A)
    "BXL-2526-00023-A-268",    // 2026 spending budget (7F/6A)
    "BXL-2425-00018-v4",       // tenants' right to challenge abusive rents (6F/5A)
    "BXL-2425-00016-v1",       // parliament cuts its own budget 5% (6F/4A)
    "BXL-2425-00006-v4",       // delay electric-taxi deadline to 2027 (7F/4A)
    "BXL-2425-00031-v9",       // cut MPs' indemnity 5% permanently (4F/7A)
    "BXL-2425-00016-v5",       // let older diesels keep driving (LEZ rollback) (9F/4A)
    "BXL-2425-00003-v10",      // postpone next LEZ phase two years (7F/3A)
    "BXL-2425-00029-v5",       // SME-guarantee fund transparency rules (3F/7A)
    "BXL-2425-00027-v4",       // shelve antisemitism action-plan call (7F/2A)
    "BXL-2425-00011-v5",       // ban gas patio heaters on terraces (9F/2A)
    "BXL-2425-00022-v5",       // demand Belgium executes ICC warrants (7F/1A)
    "BXL-2425-00023-v1",       // make airlines pay for CO2 (12F/1A)
    "BXL-2425-00031-v3",       // raise tourist city tax 4→5€ (12F/1A)
    "BXL-2526-00023-A-263"     // index former MPs' pensions (12F/1A)
  ]
};
