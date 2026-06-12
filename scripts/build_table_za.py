#!/usr/bin/env python3
"""Build cities/southafrica/data.js from data/southafrica/cards.json.

The South Africa demo has no extraction pipeline (cards are hand-authored from
the official record — Hansard / pmg.org.za); this is just the assembly step:
strip each card's `verification` audit block, attach the party table, write the
window.RIOT bundle. Run from the repo root:

    python3 scripts/build_table_za.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "southafrica" / "cards.json"
OUT = ROOT / "cities" / "southafrica" / "data.js"

# Era parties (NP, DP) appear only on the 1996 Constitutional Assembly card;
# the viewer treats absent tokens as "didn't vote comparably".
PARTIES = [
    {"token": "ANC", "name": "African National Congress", "color": "#C9A227", "logo": None},
    {"token": "DA",  "name": "Democratic Alliance",       "color": "#005BAA", "logo": None},
    {"token": "EFF", "name": "Economic Freedom Fighters", "color": "#D6231F", "logo": None},
    {"token": "IFP", "name": "Inkatha Freedom Party",     "color": "#8B1E3F", "logo": None},
    {"token": "MK",  "name": "uMkhonto weSizwe",          "color": "#1F5C40", "logo": None},
    {"token": "NP",  "name": "National Party",            "color": "#E07B39", "logo": None},
    {"token": "DP",  "name": "Democratic Party",          "color": "#4B89C8", "logo": None},
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
    "generated_for": "riot.southafrica",
    "preview": False,
    "note": "South Africa demo — 10 landmark recorded votes of the democratic-era "
            "Parliament (1996 Constitutional Assembly + National Assembly through "
            "the GNU era), hand-authored from the official record (Hansard / "
            "pmg.org.za) and aggregated to party blocs. Source of truth + audit "
            "trail: data/southafrica/cards.json.",
    "n_decisions": len(cards),
    "sessions_in_table": sorted({c["session_code"] for c in cards}),
    "parties": PARTIES,
    "decisions": cards,
}
OUT.write_text("window.RIOT = " + json.dumps(table, ensure_ascii=False) + ";\n")
print(f"wrote {OUT.relative_to(ROOT)}: {len(cards)} decisions")
