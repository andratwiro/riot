#!/usr/bin/env python3
"""Fetch the Commons '19 deck's division records from the CommonsVotes API.

Downloads the full per-MP JSON for each division in DECK (the Brexit
endgame: the three Meaningful Votes, the no-deal rejection, the extension
motion, and the eight distinct indicative-vote options — where an option was
put twice, the deck carries the CLOSER division) into
data/commons/divisions/<id>.json — the committed audit trail, analogous to
data/brussels/votes_raw.json. Re-runnable; the API is public and stable.

    python3 scripts/fetch_votes_uk.py
"""
import json, pathlib, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "commons" / "divisions"
API = "https://commonsvotes-api.parliament.uk/data/division/{}.json"

# DivisionId -> what it is (the deck's order here is chronological; the viewer
# shuffles per person anyway)
DECK = {
    562: "MV1 — approve the Withdrawal Agreement (15 Jan 2019)",
    623: "MV2 — approve the Withdrawal Agreement (12 Mar 2019)",
    628: "reject leaving without a deal, in all circumstances (13 Mar 2019)",
    633: "seek an Article 50 extension (14 Mar 2019)",
    655: "indicative B — leave with no deal on 12 April (27 Mar 2019)",
    657: "indicative H — rejoin EFTA/EEA (27 Mar 2019)",
    659: "indicative K — Labour's alternative plan (27 Mar 2019)",
    660: "indicative L — revoke Article 50 to avoid no deal (27 Mar 2019)",
    662: "indicative O — contingent preferential arrangements (27 Mar 2019)",
    664: "MV3 — approve the Withdrawal Agreement alone (29 Mar 2019)",
    666: "indicative C — customs union, round 2 (1 Apr 2019)",
    667: "indicative D — Common Market 2.0, round 2 (1 Apr 2019)",
    668: "indicative E — confirmatory public vote, round 2 (1 Apr 2019)",
}

OUT.mkdir(parents=True, exist_ok=True)
for div_id, what in DECK.items():
    dest = OUT / f"{div_id}.json"
    with urllib.request.urlopen(API.format(div_id)) as r:
        d = json.load(r)
    dest.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print(f"{div_id}: {d['AyeCount']}-{d['NoCount']}  {what}")
print(f"\nwrote {len(DECK)} divisions to {OUT.relative_to(ROOT)}/")
