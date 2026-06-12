#!/usr/bin/env python3
"""Build cities/tunisia/data.js from data/tunisia/cards.json.

The Tunisia demo has no extraction pipeline (cards are hand-authored from the
record — majles.marsad.tn / Al Bawsala + press of record); this is just the
assembly step: strip each card's `verification` audit block, attach the bloc
table, write the window.RIOT bundle. Run from the repo root:

    python3 scripts/build_table_tn.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "tunisia" / "cards.json"
OUT = ROOT / "cities" / "tunisia" / "data.js"

# CPR/Ettakatol sat only in the 2011-14 Constituent Assembly, Nidaa Tounes and
# the Popular Front only in the 2014-21 ARP; the viewer treats absent tokens
# as "didn't vote comparably".
PARTIES = [
    {"token": "ENN",  "name": "Ennahdha",                 "color": "#1B5FAA", "logo": None},
    {"token": "CPR",  "name": "Congress for the Republic","color": "#D98E04", "logo": None},
    {"token": "ETT",  "name": "Ettakatol",                "color": "#8E3B6B", "logo": None},
    {"token": "NIDA", "name": "Nidaa Tounes",             "color": "#C03A2B", "logo": None},
    {"token": "FP",   "name": "Popular Front",            "color": "#6E1420", "logo": None},
]
LEGAL = {"for", "against", "abstain"}
TOKENS = {p["token"] for p in PARTIES}

cards = json.loads(SRC.read_text())["cards"]
for c in cards:
    c.pop("verification", None)
    pv = c["party_votes_canon"]
    assert pv and set(pv) <= TOKENS and set(pv.values()) <= LEGAL, c["id"]
    assert "tally" in c, c["id"]

table = {
    "generated_for": "riot.tunisia",
    "preview": False,
    "note": "Tunisia demo — 10 landmark roll-call votes of the post-revolution "
            "parliament (2011-14 Constituent Assembly + 2014-21 ARP), hand-authored "
            "from the record (majles.marsad.tn / Al Bawsala + press of record) and "
            "aggregated to parliamentary blocs. Source of truth + audit trail: "
            "data/tunisia/cards.json.",
    "n_decisions": len(cards),
    "sessions_in_table": sorted({c["session_code"] for c in cards}),
    "parties": PARTIES,
    "decisions": cards,
}
OUT.write_text("window.RIOT = " + json.dumps(table, ensure_ascii=False) + ";\n")
print(f"wrote {OUT.relative_to(ROOT)}: {len(cards)} decisions")
