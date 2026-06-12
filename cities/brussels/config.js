// Brussels instance config. Real data: 2025-2026 Brussels-Capital Parliament roll-call
// (nominal) votes parsed from the plenary CRIs and aggregated to political groups.
// Front-end English; raw source text French. Built by scripts/*_bxl.py.
window.CITY_CONFIG = {
  id: "brussels",
  name: "Brussels",
  title: "Brussels Parliament",
  lang: "en",
  srcLang: "fr",                       // original proposal wording (CRI source) is French
  logo: "assets/logos/brussels_iris.svg",
  chamber: "the parliament",                 // live-session copy: "the room v. ..."
  live_split: true,                    // after-vote room split (only renders post-vote)
  // LIVE SESSION lobby — every visible string on the gathering screen comes from
  // here (no copy conditionals in live.js). {count}/{body} in one_liner and
  // {period}/{n} in docketCountLine are filled from the live deck + this config.
  // firstCardRule/privacyLine render on the FIRST vote card, not the lobby.
  // TODO(rob): provisional Brussels wording for the new lobby keys (live_chip,
  // title, one_liner, count_line, cta, about_label, firstCardRule, privacyLine)
  // — carried over / lightly derived from the old convocation copy; confirm
  // before the Go Vocal demo.
  lobby: {
    live_chip: "LIVE SESSION",
    title: "The room is gathering.",
    body_name: "Brussels Parliament",
    one_liner: "{count} real decisions of the {body}. You'll vote blind.",
    count_line: "in the room · waiting for the sitting to open",
    cta: "Take your seat",
    about_label: "about this sitting",
    docketInstitutionLine: "PARLIAMENT OF THE BRUSSELS-CAPITAL REGION",
    docketCountLine: "PLENARY SITTINGS {period} · {n} DECISIONS ON THE DOCKET",
    disclosure: "Decisions selected from the plenary record.",
    firstCardRule: "You vote blind: you first, then the parliament.",
    privacyLine: "Your votes never leave this phone.",
    sittingOpenedFormula: "The sitting is opened."
  },
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
  ],
  // The DEMO deck: ten contested, story-rich decisions hand-picked for live
  // demos. Pinned first in the moderator's session picker. Every card carries a
  // tellable chamber moment (deck/BRUSSELS_DEMO_TRIVIA.md, internal); the
  // tourist-tax card (00031-v3) was swapped out — its CRI preserves no debate
  // and no stage directions — for the abusive-rents card, whose vote drew the
  // quorum-break walkout (MR/N-VA/VB out of the hemicycle, 42-min suspension).
  demo_deck: [
    "BXL-2526-00021-A-264",    // producers fund the waste their packaging creates
    "BXL-2526-00014-A-29",     // recognise gynaecological & obstetric violence
    "BXL-2526-00014-A-236",    // condemn the Iranian regime's repression
    "BXL-2425-00018-v4",       // tenants v. abusive rents (the walkout vote)
    "BXL-2425-00031-v9",       // cut MPs' indemnity 5% permanently
    "BXL-2425-00022-v4",       // press for Gaza aid — air drops if needed
    "BXL-2425-00016-v1",       // parliament cuts its own budget 5%
    "BXL-2425-00013-v13",      // cancel arms-export licences to Israel
    "BXL-2425-00011-v9",       // homeless first in social housing
    "BXL-2425-00003-v10"       // postpone next LEZ phase two years
  ]
};
