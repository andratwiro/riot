#!/usr/bin/env python3
"""
build_table_bxl.py — assemble the Brussels decisions table (cities/brussels/data.js).

Pipeline:
  data/brussels/votes_raw.json  (per-MEMBER roll-calls, from extract_votes_bxl.py)
  data/brussels/roster.json     (member -> political group)
  data/brussels/cards.json      (English card copy per decision; authored separately)
        -> aggregate names to GROUPS -> per-group canonical vote (for/against/abstain)
        -> cities/brussels/data.js          (window.RIOT, same schema the viewer expects)
        -> data/brussels/decisions_skeleton.json  (the same decisions[] as committed JSON —
           the Brussels analogue of data/decisions.json; regenerated every build, never edited)

An unmapped voter (a CRI name missing from roster.json) is FATAL — it would silently
shrink that group's tally. Fix roster.json and re-run. Also prints a validation report:
per-group bloc consistency (disciplined groups vote as one — low split-rate validates
the roster). Run: python3 scripts/build_table_bxl.py
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BX = ROOT / "data" / "brussels"

# Group display metadata (token -> name, colour), ordered ~by size. Colours are brand-ish.
GROUPS = [
    ("MR",   "MR",            "#1356a0"),
    ("PS",   "PS",            "#e6002d"),
    ("PTB",  "PTB",           "#aa0022"),
    ("LE",   "Les Engagés",   "#00a99d"),
    ("Ecolo","Ecolo",         "#66a821"),
    ("DEFI", "DéFI",          "#e6007e"),
    ("GRN",  "Groen",         "#8cc63f"),
    ("TFA",  "Team F. Ahidar","#6a4ea3"),
    ("OVLD", "Open VLD",      "#2aa0e0"),
    ("NVA",  "N-VA",          "#f0a500"),
    ("VOOR", "Vooruit",       "#ff5c39"),
    ("VB",   "Vlaams Belang", "#8b5e3c"),
    ("CDV",  "CD&V",          "#f47a20"),
]
GROUP_NAME = {t: n for t, n, _ in GROUPS}

# Only these segments are real "decisions" (skip amendments / single articles / tirets /
# procedural ordre-du-jour-pur-et-simple).
def is_decision(v):
    if v["kind"] in ("MOTION", "CONF", "Urgence"):
        return True
    return v.get("segment") == "Ensemble"


def canonical(names_oui, names_non, names_abst, roster):
    """Per group: plurality of how its present members voted. Returns
    (party_votes_canon{token:for/against/abstain}, splits[list], unmapped[set])."""
    by_group = {}
    unmapped = set()
    for vote, lst in (("for", names_oui), ("against", names_non), ("abstain", names_abst)):
        for nm in lst:
            g = roster.get(nm)
            if not g:
                unmapped.add(nm); continue
            by_group.setdefault(g, {"for": 0, "against": 0, "abstain": 0})[vote] += 1
    pvc, splits = {}, []
    for g, c in by_group.items():
        win = max(c, key=c.get)
        pvc[g] = win
        total = sum(c.values())
        if c[win] < total:            # group not unanimous
            splits.append((g, c))
    return pvc, splits, unmapped


def md(x):
    """Coerce a card field to a markdown string. Some agents emit bullet lists as JSON
    arrays; turn those into '- ' lines that renderBrief understands."""
    if isinstance(x, list):
        return "\n".join(s if str(s).lstrip().startswith(("-", "*", "#")) else "- " + str(s) for s in x)
    return x or ""


def main():
    votes = json.loads((BX / "votes_raw.json").read_text())
    roster = json.loads((BX / "roster.json").read_text())["roster"]
    cards = {}
    cf = BX / "cards.json"
    if cf.exists():
        cards = json.loads(cf.read_text())

    decisions = []
    all_unmapped, split_tally, group_votes = set(), 0, 0
    for v in votes:
        # Inclusion gate. 2025-26 annex carries inline subjects, so gate on the substantive
        # grain (Ensemble / motion / urgence) — keeps amendments (which share a doc_ref) out.
        # 2024-25 annex has no subjects, so it's purely card-driven (a subagent authored a card
        # for the vote_no it judged worth voting). Either way a card must exist. ids are
        # session-namespaced; 2024-25 keys on vote_no (no doc_ref in its annex).
        if v["session"] == "2025-26":
            if not is_decision(v):
                continue
            did = f"BXL-2526-{v['cri']}-{v['doc_ref'] or ('v'+str(v['vote_no']))}"
        else:
            did = f"BXL-2425-{v['cri']}-v{v['vote_no']}"
        card = cards.get(did)
        if card is None:
            continue
        pvc, splits, unmapped = canonical(v["oui"], v["non"], v["abst"], roster)
        all_unmapped |= unmapped
        split_tally += len(splits)
        group_votes += len(pvc)
        n_for, n_against = len(v["oui"]), len(v["non"])
        outcome = "approved" if n_for > n_against else "rejected"
        raw_fr = card.get("raw_fr") or v["subject"] or ""
        decisions.append({
            "id": did,
            "date": v["date"],
            "session_code": f"PB_{v['session']}_{v['cri']}",
            "point": v["vote_no"],
            "organ": "Parlement bruxellois",
            "type": card.get("type") or {"PPR": "Proposition de résolution", "PJO": "Projet d'ordonnance",
                     "PPO": "Proposition d'ordonnance", "PO": "Projet d'ordonnance", "PJ": "Projet",
                     "P": "Proposition", "MOTION": "Motion", "CONF": "Motion de confiance",
                     "Urgence": "Demande d'urgence"}.get(v["kind"], "Texte"),
            "topic": card.get("topic", "Brussels Parliament"),
            "headline": card.get("headline") or v["subject"],
            # "original text" layer (opt-in toggle) — the French source, NO result (blind vote).
            "title": raw_fr,
            "raw_outcome": raw_fr,
            "source_brief": md(card.get("source_brief")),
            "deep_facts": md(card.get("deep_facts")),
            "deep_lectura": md(card.get("deep_lectura")),
            "proposed_by": card.get("proposed_by", ""),   # metadata, never shown in the copy
            "doc_ref": v["doc_ref"],
            "outcome": outcome,                            # structured field (log/compare), not in copy
            "tally": {"for": n_for, "against": n_against, "abstain": len(v["abst"])},  # MP head-counts — reveal margins only
            "source_url": f"http://weblex.brussels/data/crb/cri/{v['session']}/{v['cri']}/images.pdf",
            "party_votes_canon": pvc,
            "curator_drop": bool(card.get("curator_drop")),
        })

    if all_unmapped:
        raise SystemExit("unmapped voters (add to roster.json, then re-run): "
                         + ", ".join(sorted(all_unmapped)))
    used = sorted({g for d in decisions for g in d["party_votes_canon"]},
                  key=lambda t: [x[0] for x in GROUPS].index(t) if t in GROUP_NAME else 99)
    parties = [{"token": t, "name": GROUP_NAME.get(t, t),
                "color": dict((x[0], x[2]) for x in GROUPS).get(t, "#888"), "logo": None}
               for t in used]
    n_cards = sum(1 for d in decisions if d["source_brief"])
    out = {
        "generated_for": "riot.brussels",
        "preview": n_cards < len(decisions),
        "note": "Brussels-Capital Parliament 2025-2026 — roll-call (nominal) votes from the "
                "plenary CRIs, aggregated to political groups. Cards English, source French.",
        "n_decisions": len(decisions),
        "sessions_in_table": sorted({d["session_code"] for d in decisions}),
        "parties": parties,
        "decisions": decisions,
    }
    (ROOT / "cities" / "brussels" / "data.js").write_text(
        "window.RIOT = " + json.dumps(out, ensure_ascii=False) + ";")
    (BX / "decisions_skeleton.json").write_text(json.dumps(decisions, ensure_ascii=False, indent=2))

    # ---- validation report ----
    print(f"decisions: {len(decisions)}   groups used: {len(parties)}   "
          f"English cards: {n_cards}/{len(decisions)}")
    print("roster coverage: OK (all voters mapped)")   # unmapped is fatal above
    print(f"bloc consistency: {split_tally} group-splits across {group_votes} group-votes "
          f"({100*(group_votes-split_tally)/max(group_votes,1):.0f}% unanimous)")
    print("---")
    for d in decisions:
        pv = d["party_votes_canon"]
        line = "  ".join(f"{g}:{pv[g][0].upper()}" for g in pv)
        print(f"[{d['date']}] {d['headline'][:50]:50s} {d['outcome']:8s} {line}")


if __name__ == "__main__":
    main()
