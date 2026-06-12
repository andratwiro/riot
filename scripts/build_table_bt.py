#!/usr/bin/env python3
"""Build cities/bundestag/data.js from the Bundestag sources.

Commons posture, on the official machine-readable record: party_votes_canon
is COMPUTED from the per-MP roll-call records in data/bundestag/rollcalls/
(fetched + independently cross-checked by fetch_votes_bt.py) and merged with
the hand-authored German copy in data/bundestag/cards.json.

Canon rules (the Bundestag, unlike the Commons, has a REAL third option —
Enthaltung is a button on the voting card, and whole Fraktionen use it):
- a Fraktion's direction = the PLURALITY of its cast votes among
  ja / nein / Enthaltung; an exact tie = "abstain";
- nichtabgegeben / ungültig are not cast votes and never count;
- a Fraktion with zero cast votes would be an absent token — with 10 votes
  and >85% attendance everywhere this does not occur in this deck, so it
  is asserted against rather than handled;
- fraktionslose Abgeordnete are not a bloc and never aggregate.

Outcome = ja > nein (einfache Mehrheit; Enthaltungen do not tip it on any
vote in this deck — every margin is clear).

Run from the repo root:

    python3 scripts/build_table_bt.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
ROLLCALLS = ROOT / "data" / "bundestag" / "rollcalls"
SRC = ROOT / "data" / "bundestag" / "cards.json"
OUT = ROOT / "cities" / "bundestag" / "data.js"

# `blurb` = who they are in a few words, shown on the solo cover's "who sits
# here" rows. Identity only — never their direction on the deck's votes:
# that is exactly what the reveal is for. Order: Fraktion size, 21. WP.
PARTIES = [
    {"token": "UNION", "name": "CDU/CSU",          "color": "#2B2B30", "logo": None,
     "blurb": "Christdemokraten und bayerische CSU: die größte Fraktion, stellt seit Mai 2025 den Kanzler."},
    {"token": "AFD",   "name": "AfD",              "color": "#009EE0", "logo": None,
     "blurb": "Rechte Opposition, zweitstärkste Fraktion; die übrigen Parteien schließen eine Zusammenarbeit aus."},
    {"token": "SPD",   "name": "SPD",              "color": "#E3000F", "logo": None,
     "blurb": "Sozialdemokraten, die älteste Partei im Saal: Juniorpartner der Regierung."},
    {"token": "GRÜNE", "name": "Bündnis 90/Grüne", "color": "#46962B", "logo": None,
     "blurb": "Die Grünen: Ökopartei, nach gut drei Jahren am Kabinettstisch zurück in der Opposition."},
    {"token": "LINKE", "name": "Die Linke",        "color": "#BE3075", "logo": None,
     "blurb": "Sozialisten: Opposition links der Regierung, stark bei jungen Wählern in den Großstädten."},
]
TOKENS = {p["token"] for p in PARTIES}
FRAKTION_MAP = {
    "CDU/CSU": "UNION",
    "AfD": "AFD",
    "SPD": "SPD",
    "BÜ90/GR": "GRÜNE",  # 5 chars so the fallback chip fits (the NSDAP rule)
    "Die Linke": "LINKE",
    "Fraktionslos": None,  # not a bloc — never aggregated
}
CAST = ("ja", "nein", "Enthaltung")
DIR = {"ja": "for", "nein": "against", "Enthaltung": "abstain"}


def fraktion_split(rec):
    """{token: {ja, nein, Enthaltung}} over the bloc Fraktionen."""
    split = {}
    for m in rec["members"]:
        if m["fraktion"] not in FRAKTION_MAP:
            raise SystemExit(f"unmapped Fraktion {m['fraktion']!r} in {rec['id']}")
        tok = FRAKTION_MAP[m["fraktion"]]
        if tok is None or m["vote"] not in CAST:
            continue
        split.setdefault(tok, {c: 0 for c in CAST})[m["vote"]] += 1
    return split


cards = json.loads(SRC.read_text())["cards"]
for c in cards:
    rec = json.loads((ROLLCALLS / f"{c['id']}.json").read_text())
    split = fraktion_split(rec)
    assert set(split) == TOKENS, f"{c['id']}: a Fraktion cast zero votes — decide its token explicitly"
    canon = {}
    for tok, n in sorted(split.items()):
        top = max(n.values())
        leaders = [v for v in CAST if n[v] == top]
        canon[tok] = "abstain" if len(leaders) > 1 else DIR[leaders[0]]
    c["party_votes_canon"] = canon
    t = rec["totals"]
    c["tally"] = {"for": t["ja"], "against": t["nein"], "abstain": t["Enthaltung"]}
    c["outcome"] = "approved" if t["ja"] > t["nein"] else "rejected"
    c.setdefault("date", rec["date"])
    c.setdefault("session_code", f"BT21_S{rec['sitzung']}")
    c.setdefault("source_url", rec["source_xlsx"])
    # per-party report (the audit step — eyeball against the press of record)
    rep = "  ".join(f"{tok}:{n['ja']}/{n['nein']}/{n['Enthaltung']}" for tok, n in sorted(split.items()))
    print(f"{c['id']:<30} {t['ja']:>3}-{t['nein']:<3} enth {t['Enthaltung']:>2}  {rep}")
    c.pop("verification", None)

table = {
    "generated_for": "riot.bundestag",
    "preview": False,
    "note": "Deutscher Bundestag, 21. Wahlperiode — zehn namentliche Abstimmungen "
            "2025–2026, Fraktionsrichtungen berechnet aus dem amtlichen "
            "Abstimmungsverzeichnis (data/bundestag/rollcalls/, je Abgeordneter), "
            "gegengeprüft mit abgeordnetenwatch.de. Copy + Audit-Trail: "
            "data/bundestag/cards.json.",
    "n_decisions": len(cards),
    "sessions_in_table": sorted({c["session_code"] for c in cards}),
    "parties": PARTIES,
    "decisions": cards,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("window.RIOT = " + json.dumps(table, ensure_ascii=False) + ";\n")
print(f"\nwrote {OUT.relative_to(ROOT)}: {len(cards)} decisions")
