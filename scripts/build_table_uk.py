#!/usr/bin/env python3
"""Build cities/commons/data.js from the Commons '19 sources.

Unlike the Congress/SA/Tunisia demo decks (party directions hand-asserted),
this build COMPUTES party_votes_canon from the per-MP division records in
data/commons/divisions/ (fetched by fetch_votes_uk.py) and merges the
hand-authored copy from data/commons/cards.json — the Brussels posture, on
the official machine-readable record.

Canon rules:
- a party's direction = the majority of its CAST votes (ayes v. noes);
  an exact tie = "abstain";
- a party with ZERO cast votes is absent from the card (the viewer reads a
  missing token as "didn't vote comparably") — UNLESS the card carries a
  `canon_overrides` entry ({token: "abstain"}) recording a documented
  deliberate whip-abstention (e.g. the SNP sitting out the customs-union
  option). Every override must be justified in the card's `verification`.
- Independents, the Speaker and Sinn Féin are not blocs and never aggregate.

Run from the repo root:

    python3 scripts/build_table_uk.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIVS = ROOT / "data" / "commons" / "divisions"
SRC = ROOT / "data" / "commons" / "cards.json"
OUT = ROOT / "cities" / "commons" / "data.js"

PARTIES = [
    {"token": "CON", "name": "Conservative",       "color": "#1C66AE", "logo": None},
    {"token": "LAB", "name": "Labour",             "color": "#BE1322", "logo": None},
    {"token": "SNP", "name": "SNP",                "color": "#C7A500", "logo": None},
    {"token": "LD",  "name": "Liberal Democrats",  "color": "#E08C00", "logo": None},
    {"token": "DUP", "name": "DUP",                "color": "#8C2433", "logo": None},
    {"token": "PC",  "name": "Plaid Cymru",        "color": "#0A7A4A", "logo": None},
    {"token": "GRN", "name": "Green",              "color": "#4D8A1E", "logo": None},
]
TOKENS = {p["token"] for p in PARTIES}
PARTY_MAP = {
    "Conservative": "CON",
    "Labour": "LAB",
    "Scottish National Party": "SNP",
    "Liberal Democrat": "LD",
    "Democratic Unionist Party": "DUP",
    "Plaid Cymru": "PC",
    "Green Party": "GRN",
    # not blocs — never aggregated:
    "Independent": None, "Speaker": None, "Sinn Féin": None,
}
LEGAL = {"for", "against", "abstain"}


def party_split(div):
    """{token: [ayes, noes]} over the bloc parties, from the per-MP lists."""
    split = {}
    for side, idx in (("Ayes", 0), ("Noes", 1)):
        for m in div[side]:
            if m["Party"] not in PARTY_MAP:
                raise SystemExit(f"unmapped party {m['Party']!r} in division {div['DivisionId']}")
            tok = PARTY_MAP[m["Party"]]
            if tok is None:
                continue
            split.setdefault(tok, [0, 0])[idx] += 1
    return split


cards = json.loads(SRC.read_text())["cards"]
for c in cards:
    div = json.loads((DIVS / f"{c['division_id']}.json").read_text())
    split = party_split(div)
    overrides = c.pop("canon_overrides", {}) or {}
    assert set(overrides) <= TOKENS and set(overrides.values()) <= LEGAL, c["id"]
    canon = {}
    for tok, (a, n) in sorted(split.items()):
        canon[tok] = "for" if a > n else "against" if n > a else "abstain"
    for tok, d in overrides.items():
        assert tok not in canon, f"{c['id']}: override for {tok}, which cast votes"
        canon[tok] = d
    c["party_votes_canon"] = canon
    c["tally"] = {"for": div["AyeCount"], "against": div["NoCount"]}
    c["outcome"] = "approved" if div["AyeCount"] > div["NoCount"] else "rejected"
    c.setdefault("title", div["Title"])
    c.setdefault("date", div["Date"][:10])
    c.setdefault("source_url",
                 f"https://commonsvotes.digiminster.com/Divisions/Details/{c['division_id']}")
    # per-party report (the audit step — eyeball against the press of record)
    rep = "  ".join(f"{t}:{a}-{n}" for t, (a, n) in sorted(split.items()))
    ovr = ("  +override " + ",".join(f"{t}={d}" for t, d in overrides.items())) if overrides else ""
    print(f"{c['id']:<14} {div['AyeCount']:>3}-{div['NoCount']:<3} {rep}{ovr}")
    c.pop("verification", None)
    c.pop("division_id", None)

table = {
    "generated_for": "riot.commons",
    "preview": False,
    "note": "Commons 2019 — the Brexit endgame: the three Meaningful Votes, the "
            "no-deal rejection, the Article 50 extension and the eight distinct "
            "indicative-vote options, computed per party from the official "
            "CommonsVotes per-MP record (data/commons/divisions/). Copy + audit "
            "trail: data/commons/cards.json.",
    "n_decisions": len(cards),
    "sessions_in_table": sorted({c["session_code"] for c in cards}),
    "parties": PARTIES,
    "decisions": cards,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("window.RIOT = " + json.dumps(table, ensure_ascii=False) + ";\n")
print(f"\nwrote {OUT.relative_to(ROOT)}: {len(cards)} decisions")
