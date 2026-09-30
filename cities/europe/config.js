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
      "Strasbourg, the 2020s. 720 members from 27 countries decide on war, borders, cars, your private messages, even what a burger may be called. On the big questions every member presses a button, and the yes or no goes into the record by name.",
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
  // The DEMO deck, pinned first in the moderator's session picker: five cards
  // for a 10-minute slot (Rob after the 30 Sep Open Mic: ten was too long;
  // at ~30 s a card, five is the ceiling). Light opener, everyday, money,
  // war, then the finale. The other ten stay in "All plenaries".
  demo_deck: [
    "EP-2025-veggie-burger-names",          // what a burger may be called (north v. south)
    "EP-2026-chat-control-extension",       // scanning your private messages
    "EP-2023-cars-2035",                    // end new petrol and diesel cars
    "EP-2024-ukraine-strikes-inside-russia",// Western weapons on Russian soil
    "EP-2025-censure-von-der-leyen"         // sack the whole Commission
  ]
};
