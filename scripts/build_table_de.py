#!/usr/bin/env python3
"""Build cities/weimar/data.js from data/weimar/cards.json.

The Weimar deck has no extraction pipeline (no machine-readable roll-call
dataset exists for 1919–33; cards are hand-authored from the stenographic
record + the literature of record, with the verified fact base in
data/weimar/research.json). This is the assembly step, Congress convention:
strip each card's `verification` audit block, attach the party table, write
the window.RIOT bundle.

Tally conventions (the viewer's margin subtitle relies on these):
- a counted division ships its real head-count;
- an item recorded as unanimous/by acclamation ships an ALL-ZERO tally
  (renders "unanimous" — never a fabricated 0-0);
- an item whose count did not survive ships `tally: null` (verdict alone).

Run from the repo root:

    python3 scripts/build_table_de.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "weimar" / "cards.json"
OUT = ROOT / "cities" / "weimar" / "data.js"

PARTIES = [
    {"token": "SPD",   "name": "SPD",               "color": "#C8242E", "logo": None},
    {"token": "Z",     "name": "Zentrum",           "color": "#4A4036", "logo": None},
    {"token": "BVP",   "name": "BVP",               "color": "#2C5F8A", "logo": None},
    {"token": "DDP",   "name": "DDP / Staatspartei","color": "#C99700", "logo": None},
    {"token": "DVP",   "name": "DVP",               "color": "#B86A1F", "logo": None},
    {"token": "DNVP",  "name": "DNVP",              "color": "#1F3864", "logo": None},
    {"token": "NSDAP", "name": "NSDAP",             "color": "#5C4023", "logo": None},
    {"token": "KPD",   "name": "KPD",               "color": "#7E1020", "logo": None},
]
LEGAL = {"for", "against", "abstain"}
TOKENS = {p["token"] for p in PARTIES}

cards = json.loads(SRC.read_text())["cards"]
for c in cards:
    c.pop("verification", None)
    pv = c["party_votes_canon"]
    # absent tokens = walkouts, boycotts, annulled mandates, splits with no
    # documented majority — the viewer treats them as "didn't vote comparably"
    assert pv and set(pv) <= TOKENS and set(pv.values()) <= LEGAL, c["id"]
    assert c.get("tally") is None or set(c["tally"]) <= {"for", "against", "abstain"}, c["id"]

table = {
    "generated_for": "riot.weimar",
    "preview": False,
    "note": "Weimar 29–33 — ten recorded votes of the Reichstag's final years, "
            "hand-authored from the stenographic record (Verhandlungen des "
            "Reichstags) and the literature of record. A memorial deck. Source "
            "of truth + audit trail: data/weimar/cards.json + research.json.",
    "n_decisions": len(cards),
    "sessions_in_table": sorted({c["session_code"] for c in cards}),
    "parties": PARTIES,
    "decisions": cards,
}
OUT.write_text("window.RIOT = " + json.dumps(table, ensure_ascii=False) + ";\n")
print(f"wrote {OUT.relative_to(ROOT)}: {len(cards)} decisions")
