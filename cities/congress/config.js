// US Congress instance config — DEMO. Sixteen landmark roll-call votes of the
// 117th–119th Congresses, hand-authored from the official record
// (congress.gov + clerk.house.gov / senate.gov roll calls) and aggregated to
// the four floor caucuses (House/Senate × Dem/GOP). No Python pipeline yet:
// demo-grade by design; a build_table_us.py can slot in later without
// touching the cards.
window.CITY_CONFIG = {
  id: "congress",
  name: "Congress",
  masthead: "US Congress",   // header (single/async) — short; fits beside §/⚙
  masthead_full: "United States Congress",   // header (live) — chrome stripped
  title: "US Congress",
  lang: "en",
  srcLang: "en",                       // source wording = the bill's official title (English)
  logo: "assets/logos/us_capitol.svg",
  chamber: "the Congress",             // live-session copy: "the room v. ..."
  live_split: true,                    // after-vote room split (only renders post-vote)
  // SOLO cover (?solo=1): the record's first page — the lore, then the booth.
  // {n} = deck length.
  solo_lobby: {
    kicker: "The record · 117th–119th Congresses",
    title: "The votes the whole country argued about.",
    lore: [
      "Washington, the 2020s. Congresses split close to the middle take up TikTok, guns, marriage, the border, war powers and the debt ceiling. On the big questions the clerk calls the roll, and every member's yes or no goes into the record by name.",
      "Each card is a real roll-call vote from that record. You vote first, blind, as if it were on your desk today. Then the floor answers, caucus by caucus, exactly as recorded."
    ],
    parties_label: "Who votes on these floors",
    meta: "",
    cta: "Enter the booth"
  },
  // LIVE SESSION lobby — every visible string on the gathering screen comes from
  // here (no copy conditionals in live.js). {count}/{body} in one_liner and
  // {period}/{n} in docketCountLine are filled from the live deck + this config.
  // privacyLine renders on the FIRST vote card, not the lobby;
  // cta labels the seat gate's button (the shared URL gates before the lobby).
  // TODO(rob): provisional Congress wording for the new lobby keys — carried
  // over / lightly derived from the old convocation copy; confirm.
  lobby: {
    live_chip: "LIVE SESSION",
    title: "Congress is convening.",
    body_name: "US Congress",
    one_liner: "{count} real decisions of the {body}. You vote the same docket as the members, at the room's pace, and at the end you see who you agree with.",
    count_line: "in the room · waiting for the call to order",
    cta: "Take your seat",
    about_label: "about this session",
    docketInstitutionLine: "CONGRESS OF THE UNITED STATES",
    docketCountLine: "ROLL-CALL VOTES {period} · {n} DECISIONS ON THE DOCKET",
    disclosure: "Decisions selected from the official roll-call record.",
    privacyLine: "Your votes never leave this phone.",
    sittingOpenedFormula: "The House will come to order."
  },
  // The DEMO deck — the full sixteen, pinned first in the moderator's session picker.
  demo_deck: [
    "US-118-HR7521",      // TikTok: divest or be banned
    "US-119-HR1",         // the One Big Beautiful Bill (taxes, Medicaid, border)
    "US-119-SJRES59",     // war powers: the strikes on Iran's nuclear sites (rejected)
    "US-117-S2938",       // first federal gun bill in 30 years
    "US-119-HR5371",      // reopen the government on day 43 of the longest shutdown
    "US-117-HR8404",      // write same-sex marriage into federal law
    "US-119-HR23",        // sanction the ICC over the Netanyahu warrants (rejected)
    "US-117-S4132",       // codify the right to abortion (rejected)
    "US-119-S5",          // Laken Riley: detain migrants charged with theft
    "US-119-HR4",         // claw back $9bn: defund PBS/NPR + foreign aid
    "US-118-HR8035",      // $61bn for Ukraine
    "US-119-HCONRES64",   // war powers: the Venezuela campaign (rejected)
    "US-118-HR3746",      // suspend the debt ceiling, cap spending
    "US-118-HR6090",      // the IHRA antisemitism yardstick for campuses
    "US-117-HR5376",      // the climate-and-drug-prices megabill (IRA)
    "US-117-HR3684"       // $1.2tn for roads, bridges, broadband
  ]
};
