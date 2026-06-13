// Bundestag instance config — the sitting chamber, 21. Wahlperiode: ten real
// namentliche Abstimmungen 2025–2026, party directions COMPUTED from the
// official per-MP record (data/bundestag/rollcalls/, fetched + cross-checked
// by scripts/fetch_votes_bt.py, assembled by scripts/build_table_bt.py).
// The first all-German instance: copy AND chrome strings are German (Rob,
// 2026-06-12 — built to share with a German-speaking colleague). No era
// stamp: this Bundestag is sitting.
window.CITY_CONFIG = {
  id: "bundestag",
  name: "Bundestag",
  title: "Deutscher Bundestag",
  lang: "de",
  srcLang: "de",                       // original wording = the official German title
  logo: "assets/logos/de_dome.svg",
  chamber: "der Bundestag",            // live-session copy: "the room v. ..."
  live_split: true,
  // SOLO cover (?solo=1): the record's first page — the lore, then the booth.
  solo_lobby: {
    kicker: "Namentliche Abstimmungen · 2025–2026",
    title: "Wie hättest du gestimmt?",
    lore: [
      "Berlin, 2026. Seit dem Frühjahr 2025 regiert eine Koalition aus Union und SPD, gegenüber sitzen AfD, Grüne und Linke. Wehrdienst, Rente, Miete, Asyl, Spritpreis: bei den großen Fragen muss jeder Abgeordnete mit Namen Farbe bekennen.",
      "Jede Karte ist eine echte namentliche Abstimmung aus dem Plenum. Du stimmst zuerst ab, blind, als läge die Entscheidung heute auf deinem Tisch. Dann antwortet der Bundestag, Fraktion für Fraktion, genau wie im amtlichen Verzeichnis protokolliert."
    ],
    parties_label: "Wer sitzt im Plenarsaal",
    meta: "",
    cta: "Zur Abstimmung"
  },
  // LIVE SESSION lobby strings. TODO(rob): provisional wording, confirm.
  lobby: {
    live_chip: "LIVE-SITZUNG",
    title: "Der Bundestag tritt zusammen.",
    body_name: "Bundestag",
    one_liner: "{count} echte Abstimmungen des {body}. Du stimmst über dieselben Fragen ab wie die Abgeordneten, im Takt des Raums. Am Ende siehst du, mit wem du übereinstimmst.",
    count_line: "im Saal · warten auf die Glocke",
    cta: "Nimm Platz",
    about_label: "über diese Sitzung",
    docketInstitutionLine: "DEUTSCHER BUNDESTAG · BERLIN",
    docketCountLine: "NAMENTLICHE ABSTIMMUNGEN {period} · {n} ENTSCHEIDUNGEN AUF DER TAGESORDNUNG",
    disclosure: "Entscheidungen aus dem amtlichen Abstimmungsverzeichnis des Deutschen Bundestages (bundestag.de), je Abgeordneter, gegengeprüft mit abgeordnetenwatch.de.",
    privacyLine: "Deine Stimmen verlassen dieses Telefon nicht.",
    sittingOpenedFormula: "Die Sitzung ist eröffnet."
  },
  // The DEMO deck — all ten, chronological; pinned first in the moderator's picker.
  demo_deck: [
    "BT-2025-mietwucher",            // cap excessive rents via Mietwuchergesetz (rejected)
    "BT-2025-wehrdienst",            // the new military service + questionnaire
    "BT-2025-rentenpaket",           // pension level guarantee (the Junge-Gruppe story)
    "BT-2026-politikerbeleidigung",  // scrap § 188 StGB (rejected)
    "BT-2026-geas",                  // EU asylum reform, national implementation
    "BT-2026-grundsicherung",        // Bürgergeld becomes Grundsicherung
    "BT-2026-energiesteuer",         // fuel-tax cut at the pump
    "BT-2026-stromsteuer",           // electricity-tax cut bill (rejected, closest)
    "BT-2026-bafoeg",                // bury the BAföG-reform motion
    "BT-2026-emissionsmengen"        // emission caps 2031–2040
  ]
};
