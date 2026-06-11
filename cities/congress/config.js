// US Congress instance config — DEMO. Ten landmark roll-call votes of the
// 117th–119th Congresses, hand-authored from the official record
// (congress.gov + clerk.house.gov / senate.gov roll calls) and aggregated to
// the four floor caucuses (House/Senate × Dem/GOP). No Python pipeline yet:
// demo-grade by design; a build_table_us.py can slot in later without
// touching the cards.
window.CITY_CONFIG = {
  id: "congress",
  name: "Congress",
  title: "CONGRESS",
  lang: "en",
  srcLang: "en",                       // source wording = the bill's official title (English)
  logo: "assets/logos/us_capitol.svg",
  chamber: "the Congress",             // live-session copy: "the room v. ..."
  live_split: true,                    // after-vote room split (only renders post-vote)
  // LIVE SESSION lobby — every visible string on the gathering screen comes from
  // here (no copy conditionals in live.js). {period} and {n} in docketCountLine
  // are computed from the active deck's metadata at render time.
  lobby: {
    eyebrow: "LIVE SESSION · U.S. CONGRESS",
    headline: "The room is gathering.",
    body: "A seat in the United States Congress has been opened for you. The decisions are real — landmark votes taken on the floor of the House and the Senate. The elected members have already voted on every one of them. You'll vote the same docket, blind, and then see where you and they part ways.",
    docketInstitutionLine: "CONGRESS OF THE UNITED STATES",
    docketCountLine: "ROLL-CALL VOTES {period} · {n} DECISIONS ON THE DOCKET",
    statusWaiting: "waiting for the session to be called to order",
    privacyLine: "Your votes stay on this phone. The room only ever sees counts.",
    disclosure: "Decisions selected from the official roll-call record.",
    sittingOpenedFormula: "The House will come to order."
  },
  // The DEMO deck — the full ten, pinned first in the moderator's session picker.
  demo_deck: [
    "US-118-HR7521",   // TikTok: divest or be banned
    "US-119-HR1",      // the One Big Beautiful Bill (taxes, Medicaid, border)
    "US-117-S2938",    // first federal gun bill in 30 years
    "US-117-HR8404",   // write same-sex marriage into federal law
    "US-117-S4132",    // codify the right to abortion (rejected)
    "US-119-S5",       // Laken Riley: detain migrants charged with theft
    "US-118-HR8035",   // $61bn for Ukraine
    "US-118-HR3746",   // suspend the debt ceiling, cap spending
    "US-117-HR5376",   // the climate-and-drug-prices megabill (IRA)
    "US-117-HR3684"    // $1.2tn for roads, bridges, broadband
  ]
};
