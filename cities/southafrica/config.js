// South Africa instance config — DEMO. Ten landmark recorded votes of the
// democratic-era Parliament (the 1996 Constitutional Assembly + the National
// Assembly through the 2024 GNU era), hand-authored from the official record
// (Hansard / pmg.org.za) and aggregated to party blocs. No Python pipeline:
// demo-grade by design, same convention as the Congress instance.
window.CITY_CONFIG = {
  id: "southafrica",
  name: "South Africa",
  title: "Parliament of South Africa",   // tab title — English is the House's own working language
  lang: "en",
  srcLang: "en",                       // source wording = the bill's official title (English)
  logo: "assets/logos/za_protea.svg",
  chamber: "the House",                // live-session copy: "the room v. ..."
  live_split: true,                    // after-vote room split (only renders post-vote)
  // SOLO cover (?solo=1): the record's first page — the lore, then the booth.
  // {n} = deck length.
  solo_lobby: {
    kicker: "The record · 1996–2025",
    title: "Thirty years of the new South Africa.",
    lore: [
      "Cape Town, 1996. Two years after the country's first democratic election, its Parliament is writing the rules of the new South Africa: a constitution first, then three decades of fights over marriage, state secrets, land, health care and the public purse.",
      "Each card is a real recorded vote of the democratic-era Parliament. You vote first, blind, as if it were on your desk today. Then the House answers, party by party, exactly as recorded."
    ],
    parties_label: "Who sits in this House",
    meta: "{n} recorded votes · 1996–2025 · Parliament of South Africa",
    cta: "Enter the booth",
    note: "Your votes stay on this phone."
  },
  // LIVE SESSION lobby — every visible string on the gathering screen comes from
  // here (no copy conditionals in live.js). {count}/{body} in one_liner and
  // {period}/{n} in docketCountLine are filled from the live deck + this config.
  // privacyLine renders on the FIRST vote card, not the lobby.
  lobby: {
    live_chip: "LIVE SESSION",
    title: "The House is convening.",
    body_name: "National Assembly of South Africa",
    one_liner: "{count} real decisions of the {body}. You vote the same order paper as the MPs, at the room's pace, and at the end you see who you agree with.",
    count_line: "in the room · waiting for the call to order",
    cta: "Take your seat",
    about_label: "about this session",
    docketInstitutionLine: "PARLIAMENT OF THE REPUBLIC OF SOUTH AFRICA",
    docketCountLine: "RECORDED VOTES {period} · {n} DECISIONS ON THE DOCKET",
    disclosure: "Decisions selected from the official record of the National Assembly.",
    privacyLine: "Your votes never leave this phone.",
    sittingOpenedFormula: "Order, order. The House is in session."
  },
  // The DEMO deck — the full ten, pinned first in the moderator's session picker.
  demo_deck: [
    "ZA-1996-CONSTITUTION",   // adopt the post-apartheid Constitution
    "ZA-2006-CIVILUNION",     // same-sex marriage — first in Africa
    "ZA-2011-SECRECY",        // the "Secrecy Bill" (state-information classification)
    "ZA-2021-S25LAND",        // expropriation without compensation in the Constitution (failed)
    "ZA-2022-PHALAPHALA",     // open impeachment proceedings over the sofa cash (rejected)
    "ZA-2023-NHI",            // universal public health insurance
    "ZA-2023-ISRAEL",         // close the Israeli embassy, suspend ties
    "ZA-2024-BELA",           // state oversight of school language/admissions
    "ZA-2024-EXPROPRIATION",  // the Expropriation Act (nil compensation in defined cases)
    "ZA-2025-BUDGET"          // the GNU's VAT-hike fiscal framework
  ]
};
