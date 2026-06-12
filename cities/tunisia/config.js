// Tunisia instance config — DEMO. Ten landmark roll-call votes of the
// post-revolution parliament (the 2011-14 National Constituent Assembly + the
// 2014-21 Assembly of the Representatives of the People), hand-authored from
// the record (majles.marsad.tn / Al Bawsala + press of record) and aggregated
// to parliamentary blocs. The chamber Kais Saied locked in 2021 — a memorial
// deck. No Python pipeline: demo-grade by design, same convention as Congress.
window.CITY_CONFIG = {
  id: "tunisia",
  name: "Tunisia",
  title: "البرلمان التونسي",          // tab title — Arabic, the instance's own language
  lang: "en",
  srcLang: "fr",                       // source wording (JORT / Marsad) is French
  logo: "assets/logos/tn_crescent.svg",
  chamber: "the Assembly",             // live-session copy: "the room v. ..."
  live_split: true,                    // after-vote room split (only renders post-vote)
  // LIVE SESSION lobby — every visible string on the gathering screen comes from
  // here (no copy conditionals in live.js). {count}/{body} in one_liner and
  // {period}/{n} in docketCountLine are filled from the live deck + this config.
  // firstCardRule/privacyLine render on the FIRST vote card, not the lobby.
  lobby: {
    live_chip: "LIVE SESSION",
    title: "The Assembly is gathering.",
    body_name: "Tunisian parliament",
    one_liner: "{count} real decisions of the {body}. You'll vote blind.",
    count_line: "in the room · waiting for the sitting to open",
    cta: "Take your seat",
    about_label: "about this sitting",
    docketInstitutionLine: "REPUBLIC OF TUNISIA · THE ASSEMBLY, BARDO PALACE",
    docketCountLine: "PLENARY VOTES {period} · {n} DECISIONS ON THE DOCKET",
    disclosure: "Decisions selected from the plenary record (Al Bawsala / Marsad).",
    firstCardRule: "You vote blind: you first, then the Assembly.",
    privacyLine: "Your votes never leave this phone.",
    sittingOpenedFormula: "The sitting is open."
  },
  // The DEMO deck — the full ten, pinned first in the moderator's session picker.
  demo_deck: [
    "TN-2014-CONSTITUTION",   // adopt the post-revolution Constitution
    "TN-2014-ART1",           // keep Islam as the state's religion (Article 1)
    "TN-2014-ART46",          // women's rights + parity in the Constitution
    "TN-2014-EXCLUSION",      // ban old-regime officials from running (rejected)
    "TN-2015-TERROR",         // the counter-terrorism law after Bardo & Sousse
    "TN-2016-ESSID",          // parliament fires the prime minister
    "TN-2017-VAW",            // the landmark violence-against-women law
    "TN-2017-AMNESTY",        // amnesty for Ben Ali-era officials
    "TN-2018-RACISM",         // criminalise racial discrimination — first in the Arab world
    "TN-2018-COMMUNES"        // the decentralisation code before the first free local elections
  ]
};
