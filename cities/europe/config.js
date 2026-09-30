// Europe instance config — DEMO. Ten landmark roll-call votes of the European
// Parliament plenary (2019–2026, 8th to 10th terms), hand-authored from the
// official record (HowTheyVote.eu + europarl.europa.eu) and aggregated to the
// 27 national delegations: you are compared with COUNTRIES, not parties (Rob,
// 2026-09-30: legible at a glance and safe for a mixed work room). No Python pipeline yet:
// assembly only, scripts/build_table_eu.py. Built for the 30 Sep 2026 Go Vocal
// demo (Rob: "critical / crazy decisions voted across the continent").
window.CITY_CONFIG = {
  id: "europe",
  name: "Europe",
  masthead: "European Parliament",
  title: "European Parliament",
  lang: "en",
  srcLang: "en",                       // source wording = the official English title
  logo: "assets/logos/eu_stars.svg",
  chamber: "the Parliament",           // live-session copy: "the room v. ..."
  live_split: true,
  party_word: "country",               // compared "parties" are national delegations
  party_words: "countries",
  solo_lobby: {
    kicker: "The record · European Parliament 2019–2026",
    title: "The votes a whole continent argued about.",
    lore: [
      "Strasbourg, the 2020s. 720 members from 27 countries take up weapons, borders, cars, AI, wolves and trade. On the big questions every member presses a button, and the yes or no goes into the record by name.",
      "Each card is a real vote from that record. You vote first, blind, as if it were on your desk today. Then the Parliament answers, country by country: how most of each country's members voted, exactly as recorded."
    ],
    parties_label: "Who votes: every country's members",
    meta: "{n} roll-call votes · 2019–2026 · official plenary record",
    cta: "Enter the booth",
    note: "Your votes stay on this phone."
  },
  lobby: {
    live_chip: "LIVE SESSION",
    title: "The Parliament is in session.",
    body_name: "European Parliament",
    one_liner: "{count} real decisions of the {body}. You vote the same agenda as the MEPs, at the room's pace, and at the end you see which country votes like you.",
    count_line: "in the room · waiting for the sitting to open",
    cta: "Take your seat",
    about_label: "about this sitting",
    docketInstitutionLine: "EUROPEAN PARLIAMENT · PLENARY",
    docketCountLine: "ROLL-CALL VOTES {period} · {n} DECISIONS ON THE DOCKET",
    disclosure: "Decisions selected from the official roll-call record.",
    privacyLine: "Your votes never leave this phone.",
    sittingOpenedFormula: "The sitting is opened."
  },
  // The DEMO deck, pinned first in the moderator's session picker: spiciest
  // first, so a 10-minute slot can trim to the top three or four.
  demo_deck: [
    "EP-2025-censure-von-der-leyen",     // throw out the whole Commission
    "EP-2025-rearm-europe",              // rearm Europe now
    "EP-2024-ai-act",                    // the AI Act
    "EP-2023-cars-2035",                 // end new petrol and diesel cars
    "EP-2024-migration-pact-solidarity", // share asylum seekers or pay
    "EP-2019-copyright-upload-filters",  // upload filters
    "EP-2025-wolf-protection",           // wolves
    "EP-2022-taxonomy-gas-nuclear",      // gas and nuclear as green
    "EP-2024-nature-restoration",        // repair nature
    "EP-2026-mercosur-court"             // Mercosur to the Court
  ]
};
