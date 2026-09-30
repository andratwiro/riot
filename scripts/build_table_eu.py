#!/usr/bin/env python3
"""Build cities/europe/data.js from the Europe sources.

Commons/Bundestag posture: party_votes_canon, tally and outcome are COMPUTED
from the per-MEP roll calls in data/europe/rollcalls/ (fetched + cross-checked
by fetch_votes_eu.py) and merged with the hand-authored English copy in
data/europe/cards.json (its `verification` audit blocks are stripped). The compared "parties" are the 27 national delegations (the UK, which
split 31-30 on the 2019 copyright vote, never reaches a direction and so
is not listed). A country's direction (`party_votes_canon`) is its MEPs'
plurality when it is at least 55% of those voting and untied; otherwise the
country is left out of that card as split (the viewer treats absent tokens
as "didn't vote comparably"). Per-country counts, from HowTheyVote.eu, stay in
each card's `verification` block in cards.json.

    python3 scripts/build_table_eu.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "europe" / "cards.json"
ROLLCALLS = ROOT / "data" / "europe" / "rollcalls"
SPLIT = 0.55   # a delegation needs >= 55% behind one option to count as a direction
OUT = ROOT / "cities" / "europe" / "data.js"

# The "parties" are the national delegations: every country's MEPs, whatever
# their political group. `blurb` = identity only, never a direction.
PARTIES = [
    {"token": "DE", "name": "Germany", "color": "#1F1F1F", "logo": None,
     "blurb": "96 seats today, elected by voters in Germany."},
    {"token": "FR", "name": "France", "color": "#1F3F99", "logo": None,
     "blurb": "81 seats today, elected by voters in France."},
    {"token": "IT", "name": "Italy", "color": "#1E8A4C", "logo": None,
     "blurb": "76 seats today, elected by voters in Italy."},
    {"token": "ES", "name": "Spain", "color": "#C8102E", "logo": None,
     "blurb": "61 seats today, elected by voters in Spain."},
    {"token": "PL", "name": "Poland", "color": "#D4213D", "logo": None,
     "blurb": "53 seats today, elected by voters in Poland."},
    {"token": "RO", "name": "Romania", "color": "#E0B000", "logo": None,
     "blurb": "33 seats today, elected by voters in Romania."},
    {"token": "NL", "name": "Netherlands", "color": "#E86A10", "logo": None,
     "blurb": "31 seats today, elected by voters in Netherlands."},
    {"token": "BE", "name": "Belgium", "color": "#B8860B", "logo": None,
     "blurb": "22 seats today, elected by voters in Belgium."},
    {"token": "CZ", "name": "Czechia", "color": "#11457E", "logo": None,
     "blurb": "21 seats today, elected by voters in Czechia."},
    {"token": "GR", "name": "Greece", "color": "#3F7FC4", "logo": None,
     "blurb": "21 seats today, elected by voters in Greece."},
    {"token": "HU", "name": "Hungary", "color": "#477050", "logo": None,
     "blurb": "21 seats today, elected by voters in Hungary."},
    {"token": "PT", "name": "Portugal", "color": "#006600", "logo": None,
     "blurb": "21 seats today, elected by voters in Portugal."},
    {"token": "SE", "name": "Sweden", "color": "#006AA7", "logo": None,
     "blurb": "21 seats today, elected by voters in Sweden."},
    {"token": "AT", "name": "Austria", "color": "#A6192E", "logo": None,
     "blurb": "20 seats today, elected by voters in Austria."},
    {"token": "BG", "name": "Bulgaria", "color": "#00966E", "logo": None,
     "blurb": "17 seats today, elected by voters in Bulgaria."},
    {"token": "DK", "name": "Denmark", "color": "#9E1B32", "logo": None,
     "blurb": "15 seats today, elected by voters in Denmark."},
    {"token": "FI", "name": "Finland", "color": "#2E5FA8", "logo": None,
     "blurb": "15 seats today, elected by voters in Finland."},
    {"token": "SK", "name": "Slovakia", "color": "#0B4EA2", "logo": None,
     "blurb": "15 seats today, elected by voters in Slovakia."},
    {"token": "IE", "name": "Ireland", "color": "#169B62", "logo": None,
     "blurb": "14 seats today, elected by voters in Ireland."},
    {"token": "HR", "name": "Croatia", "color": "#C4122F", "logo": None,
     "blurb": "12 seats today, elected by voters in Croatia."},
    {"token": "LT", "name": "Lithuania", "color": "#8A7A00", "logo": None,
     "blurb": "11 seats today, elected by voters in Lithuania."},
    {"token": "LV", "name": "Latvia", "color": "#7E2530", "logo": None,
     "blurb": "9 seats today, elected by voters in Latvia."},
    {"token": "SI", "name": "Slovenia", "color": "#2B6CB0", "logo": None,
     "blurb": "9 seats today, elected by voters in Slovenia."},
    {"token": "EE", "name": "Estonia", "color": "#0072CE", "logo": None,
     "blurb": "7 seats today, elected by voters in Estonia."},
    {"token": "CY", "name": "Cyprus", "color": "#C46A12", "logo": None,
     "blurb": "6 seats today, elected by voters in Cyprus."},
    {"token": "LU", "name": "Luxembourg", "color": "#00A1DE", "logo": None,
     "blurb": "6 seats today, elected by voters in Luxembourg."},
    {"token": "MT", "name": "Malta", "color": "#9A1B2B", "logo": None,
     "blurb": "6 seats today, elected by voters in Malta."},
]
LEGAL = {"for", "against", "abstain"}
TOKENS = {p["token"] for p in PARTIES}

def country_direction(members):
    n = {k: sum(1 for m in members if m["vote"] == k) for k in LEGAL}
    cast = sum(n.values())
    (top, a), (_, b) = sorted(n.items(), key=lambda x: -x[1])[:2]
    return top if cast and a > b and a / cast >= SPLIT else None   # else: split, left out


cards = json.loads(SRC.read_text())["cards"]
for c in cards:
    c.pop("verification", None)
    rc = json.loads((ROLLCALLS / f"{c['id']}.json").read_text())
    by = {}
    for m in rc["members"]:
        by.setdefault(m["country"], []).append(m)
    c["party_votes_canon"] = {cc: d for cc, ms in sorted(by.items()) if (d := country_direction(ms))}
    c["tally"] = rc["totals"]
    # outcome as recorded, never a recount (a censure motion needs two thirds,
    # an objection to a Commission act an absolute majority of 353). Where the
    # mirror carries no result (gas/nuclear, cars 2035) the authored outcome in
    # cards.json stands, checked against the official minutes in `verification`.
    if rc.get("result"):
        c["outcome"] = {"ADOPTED": "approved", "REJECTED": "rejected"}[rc["result"]]
    assert c.get("outcome") in ("approved", "rejected"), c["id"]
    assert set(c["party_votes_canon"]) <= TOKENS, (c["id"], set(c["party_votes_canon"]) - TOKENS)
    assert "\u2014" not in json.dumps(c, ensure_ascii=False).replace(c["title"], "").replace(c["raw_outcome"], ""), c["id"] + ": em dash"
cards.sort(key=lambda c: c["date"])

table = {
    "generated_for": "riot.europe",
    "preview": False,
    "note": "Europe demo: landmark roll-call votes of the European Parliament "
            "plenary 2019-2026, hand-authored from the official record "
            "(HowTheyVote.eu, europarl.europa.eu) and aggregated to the national "
            "delegations. Source of truth + audit trail: data/europe/cards.json.",
    "n_decisions": len(cards),
    "sessions_in_table": sorted({c["session_code"] for c in cards}),
    "parties": PARTIES,
    "decisions": cards,
}
OUT.write_text("window.RIOT = " + json.dumps(table, ensure_ascii=False) + ";\n")
print(f"wrote {OUT.relative_to(ROOT)}: {len(cards)} decisions")
