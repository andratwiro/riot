// Tunisia instance config — DEMO. Ten landmark roll-call votes of the
// post-revolution parliament (the 2011-14 National Constituent Assembly + the
// 2014-21 Assembly of the Representatives of the People), hand-authored from
// the record (majles.marsad.tn / Al Bawsala + press of record) and aggregated
// to parliamentary blocs. The chamber Kais Saied locked in 2021 — a memorial
// deck. No Python pipeline: demo-grade by design, same convention as Congress.
window.CITY_CONFIG = {
  id: "tunisia",
  name: "Tunisia 14–18",          // era-stamped: the deck is 2014–2018 and the chamber is gone — must never read as current
  masthead: "البرلمان التونسي",   // header — institution only (Arabic); the era lives in the tab title + solo cover
  title: "البرلمان التونسي 2014–2018",   // tab title — Arabic, the instance's own language, era-stamped
  lang: "en",
  srcLang: "fr",                       // source wording (JORT / Marsad) is French
  logo: "assets/logos/tn_crescent.svg",
  chamber: "the Assembly",             // live-session copy: "the room v. ..."
  live_split: true,                    // after-vote room split (only renders post-vote)
  // SOLO cover (?solo=1): the record's first page — the lore, then the booth.
  // A memorial deck, like Weimar: the lore carries the era's arc and its end.
  // {n} = deck length.
  solo_lobby: {
    kicker: "The record · 2014–2018",
    title: "The Arab Spring's one democracy, vote by vote.",
    lore: [
      "Tunis, 2014. Three years after a street vendor's death set off a revolution, Tunisia is the one country of the Arab Spring still building a democracy: a new constitution on the table, Islamists and secularists in the same room, terror attacks testing it from outside.",
      "Each card is a real vote of that parliament, tracked seat by seat by the watchdog Al Bawsala. You vote first, blind, as if it were on your desk today. Then the assembly answers, bloc by bloc, exactly as recorded.",
      "The deck ends in 2018. In July 2021 the president froze this parliament; the next year he dissolved it."
    ],
    parties_label: "Who sits in this assembly",
    meta: "",
    cta: "Open the record"
  },
  // LIVE SESSION lobby — every visible string on the gathering screen comes from
  // here (no copy conditionals in live.js). {count}/{body} in one_liner and
  // {period}/{n} in docketCountLine are filled from the live deck + this config.
  // privacyLine renders on the FIRST vote card, not the lobby.
  lobby: {
    live_chip: "LIVE SESSION",
    title: "The Assembly is gathering.",
    body_name: "Tunisian parliament",
    one_liner: "{count} real decisions of the {body}. You vote the same agenda as the deputies, at the room's pace, and at the end you see who you agree with.",
    count_line: "in the room · waiting for the sitting to open",
    cta: "Take your seat",
    about_label: "about this sitting",
    docketInstitutionLine: "REPUBLIC OF TUNISIA · THE ASSEMBLY, BARDO PALACE",
    docketCountLine: "PLENARY VOTES {period} · {n} DECISIONS ON THE DOCKET",
    disclosure: "Decisions selected from the plenary record (Al Bawsala / Marsad).",
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
