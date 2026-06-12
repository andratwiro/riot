// Weimar instance config — the Reichstag's final years, 1929–1933: ten real
// recorded votes tracing a democracy from a working majority to the Enabling
// Act. Hand-authored from the stenographic record + literature of record
// (data/weimar/cards.json, assembled by scripts/build_table_de.py). A memorial
// deck: the instance name wears its years (era-stamp convention, AGENTS.md) —
// the chamber it shows never sat freely again.
window.CITY_CONFIG = {
  id: "weimar",
  name: "Weimar 29–33",
  title: "Reichstag 1929–1933",
  lang: "en",
  srcLang: "de",                       // original wording = the item's official German title
  logo: "assets/logos/de_eagle.svg",
  chamber: "the Reichstag",            // live-session copy: "the room v. ..."
  live_split: true,
  // SOLO cover (?solo=1): the record's first page — the lore, then the booth.
  solo_lobby: {
    kicker: "The record · 1929–1933",
    title: "The last votes of a republic.",
    lore: [
      "Berlin, 1929. The Weimar Republic is ten years old — a democracy carrying the bill for a lost war, with a depression on its way and parties at both ends of the chamber that want the whole system gone.",
      "Each card is a real Reichstag vote from its final years, in its own words. You vote first, blind, as if it were on your desk today. Then the chamber answers, party by party, exactly as recorded.",
      "The deck ends in March 1933. The chamber it shows never voted freely again."
    ],
    meta: "{n} recorded votes · 1929–1933 · Reichstag",
    cta: "Open the record",
    note: "Your votes stay on this phone."
  },
  // LIVE SESSION lobby strings. TODO(rob): provisional wording, confirm.
  lobby: {
    live_chip: "LIVE SESSION",
    title: "The Reichstag is convening.",
    body_name: "Reichstag",
    one_liner: "{count} real votes of the {body}, 1929–1933. You vote the same questions as the deputies, at the room's pace, and at the end you see who you agree with.",
    count_line: "in the room · waiting for the bell",
    cta: "Take your seat",
    about_label: "about this session",
    docketInstitutionLine: "DEUTSCHER REICHSTAG · BERLIN",
    docketCountLine: "RECORDED VOTES {period} · {n} DECISIONS ON THE DOCKET",
    disclosure: "Decisions from the stenographic record (Verhandlungen des Reichstags) and the literature of record.",
    privacyLine: "Your votes never leave this phone.",
    sittingOpenedFormula: "Die Sitzung ist eröffnet."
  },
  // The DEMO deck — all ten, chronological; pinned first in the moderator's picker.
  demo_deck: [
    "DE-1929-freiheitsgesetz",     // criminalise cooperating with reparations (rejected)
    "DE-1930-young-plan",          // ratify the Young Plan
    "DE-1930-deckungsvorlage",     // Brüning's budget-cover bill (rejected → decree)
    "DE-1930-art48-revolt",        // revoke the Art. 48 emergency decree (→ dissolution)
    "DE-1930-toleration",          // the SPD toleration vote
    "DE-1931-geschaeftsordnung",   // standing-orders reform v. obstruction
    "DE-1931-harzburg-misstrauen", // no confidence after the Harzburg Front (rejected)
    "DE-1932-papen-misstrauen",    // 512–42 against the cabinet of barons
    "DE-1933-ermaechtigung",       // the Enabling Act
    "DE-1933-friedensresolution"   // the unanimous "peace resolution" coda
  ]
};
