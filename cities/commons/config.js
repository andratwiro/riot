// Commons 2019 instance config — the Brexit endgame in the House of Commons:
// the three Meaningful Votes, the no-deal rejection, the Article 50 extension
// and the eight distinct indicative-vote options, computed per party from the
// official CommonsVotes per-MP record (scripts/fetch_votes_uk.py +
// build_table_uk.py). A historical deck: the instance name wears the year
// (era-stamp convention, AGENTS.md) — this House dissolved in Nov 2019.
window.CITY_CONFIG = {
  id: "commons",
  name: "Commons 2019",
  masthead: "House of Commons",   // header — institution only; the era lives in the tab title + solo cover
  title: "House of Commons · 2019",
  lang: "en",
  srcLang: "en",                       // original wording = the division's official title
  logo: "assets/logos/uk_portcullis.svg",
  chamber: "the House",                // live-session copy: "the room v. ..."
  live_split: true,
  // SOLO cover (?solo=1): the record's first page — the lore of the process,
  // then one button into the booth. {n} = deck length.
  solo_lobby: {
    kicker: "The record · 2019",
    title: "The spring the House took the wheel.",
    lore: [
      "Early 2019. The country has voted to leave the European Union; its Parliament must now choose how, and every road out crosses someone's red line. For three months the House of Commons votes on exits soft, hard and none at all, while the legal deadline counts down.",
      "These are the real divisions of that spring. You vote on each one first, blind. Then the House votes back, party by party, exactly as recorded."
    ],
    parties_label: "Who sits in this House",
    meta: "{n} divisions · Jan–Apr 2019 · official CommonsVotes record",
    cta: "Open the record",
    note: "Your votes stay on this phone."
  },
  // LIVE SESSION lobby strings. TODO(rob): provisional wording, confirm.
  lobby: {
    live_chip: "LIVE SESSION",
    title: "The House is sitting.",
    body_name: "House of Commons",
    one_liner: "{count} real divisions of the {body}, spring 2019. You vote the same questions as the MPs, at the room's pace, and at the end you see who you agree with.",
    count_line: "in the room · waiting for the Speaker",
    cta: "Take your seat",
    about_label: "about this session",
    docketInstitutionLine: "HOUSE OF COMMONS · WESTMINSTER",
    docketCountLine: "DIVISIONS {period} · {n} DECISIONS ON THE DOCKET",
    disclosure: "Decisions from the official CommonsVotes per-MP record.",
    privacyLine: "Your votes never leave this phone.",
    sittingOpenedFormula: "Order. Order."
  },
  // The DEMO deck — all thirteen, chronological; pinned first in the moderator's picker.
  demo_deck: [
    "UK-2019-D562",   // MV1: approve the Withdrawal Agreement + Political Declaration
    "UK-2019-D623",   // MV2: the deal + the Strasbourg instruments
    "UK-2019-D628",   // reject leaving without a deal, in any circumstances
    "UK-2019-D633",   // seek an Article 50 extension
    "UK-2019-D655",   // indicative B: leave with no deal on 12 April
    "UK-2019-D657",   // indicative H: single market via EFTA/EEA, no customs union
    "UK-2019-D659",   // indicative K: Labour's alternative plan
    "UK-2019-D660",   // indicative L: revoke Article 50 rather than no deal
    "UK-2019-D662",   // indicative O: GATT XXIV standstill arrangements
    "UK-2019-D664",   // MV3: the Withdrawal Agreement alone, on exit day
    "UK-2019-D666",   // indicative C: permanent customs union (lost by 3)
    "UK-2019-D667",   // indicative D: Common Market 2.0
    "UK-2019-D668"    // indicative E: confirmatory public vote
  ]
};
