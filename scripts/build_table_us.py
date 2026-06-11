#!/usr/bin/env python3
"""Build cities/congress/data.js from data/congress/cards.json.

The Congress demo has no extraction pipeline (cards are hand-authored from the
official record); this is just the assembly step: strip each card's
`verification` audit block, attach the four-caucus party table, write the
window.RIOT bundle. Run from the repo root:

    python3 scripts/build_table_us.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "congress" / "cards.json"
OUT = ROOT / "cities" / "congress" / "data.js"

PARTIES = [
    {"token": "HDEM", "name": "House Democrats",    "color": "#16437F", "logo": None},
    {"token": "HGOP", "name": "House Republicans",  "color": "#7E1623", "logo": None},
    {"token": "SDEM", "name": "Senate Democrats",   "color": "#4079CE", "logo": None},
    {"token": "SGOP", "name": "Senate Republicans", "color": "#C9303E", "logo": None},
]
LEGAL = {"for", "against", "abstain"}
TOKENS = {p["token"] for p in PARTIES}

cards = json.loads(SRC.read_text())["cards"]
for c in cards:
    c.pop("verification", None)
    pv = c["party_votes_canon"]
    assert set(pv) == TOKENS and set(pv.values()) <= LEGAL, c["id"]

table = {
    "generated_for": "riot.congress",
    "preview": False,
    "note": "US Congress demo — 10 landmark roll-call votes of the 117th-119th "
            "Congresses, hand-authored from the official record (clerk.house.gov / "
            "senate.gov / congress.gov) and aggregated to the four floor caucuses. "
            "Source of truth + audit trail: data/congress/cards.json.",
    "n_decisions": len(cards),
    "sessions_in_table": sorted({c["session_code"] for c in cards}),
    "parties": PARTIES,
    "decisions": cards,
}
OUT.write_text("window.RIOT = " + json.dumps(table, ensure_ascii=False) + ";\n")
print(f"wrote {OUT.relative_to(ROOT)}: {len(cards)} decisions")
