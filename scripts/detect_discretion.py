#!/usr/bin/env python3
"""
RIOT — auto-detect LOW-DISCRETION items (proposes drops; never disposes).

A decision is worth voting on only if a citizen's values produce a meaningful
for/against. Two things remove that: the council had **no real choice** (mandated by
higher law, pure procedure, symbolic) — UNLESS someone actually turned it political
(observed contestation rescues it; a 'no' on a mandate is a real values stance).

This script reads data/decisions.json and emits data/auto_discretion.json with a
PROPOSAL per item. It is the recall half of the gate; the human (curator_marks.json)
is precision + ground truth. Nothing here hides anything — build_table only ever acts
on curator_marks.json. Run it to see proposals and how they compare to the human flags.
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEC = ROOT / "data" / "decisions.json"
OUT = ROOT / "data" / "auto_discretion.json"
MARKS = ROOT / "data" / "curator_marks.json"

# Phrases that signal the council had little real choice (scanned over title+copy).
MANDATE = [r"reial decret", r"\brdl\b", r"ho mana l'estat", r"fixad[ao] per l'estat",
           r"obligat\b", r"obligatori per", r"com obliga", r"requisit per",
           r"\bllei \d", r"\bdecret \d", r"acord de govern", r"per llei\b", r"estatal"]
PROCEDURAL = [r"designar.*representant", r"nomenament de membres", r"el tria el sector",
              r"ratificar", r"pren coneixement", r"menció honorífica", r"distinció honorífica",
              r"canvi de representant", r"reclassificaci"]
CONTEST_THRESHOLD = 0.20   # against-share that rescues a mandated item (tuned on the human flags)

def signals(text):
    t = (text or "").lower()
    return ([p for p in MANDATE if re.search(p, t)],
            [p for p in PROCEDURAL if re.search(p, t)])

def against_share(d):
    t = d.get("tally") or {}
    f, a, ab = (t.get("for") or 0), (t.get("against") or 0), (t.get("abstain") or 0)
    tot = f + a + ab
    return (a / tot) if tot else 0.0   # unanimous → 0

def main():
    dec = json.loads(DEC.read_text())["decisions"]
    human = {m["id"] for m in json.loads(MARKS.read_text())} if MARKS.exists() else set()
    out = []
    for d in dec:
        text = " ".join(filter(None, [d.get("title"), d.get("headline"),
                                       d.get("source_brief"), d.get("deep")]))
        man, proc = signals(text)
        share = against_share(d)
        low_discretion = bool(man or proc)
        contested = share >= CONTEST_THRESHOLD
        propose = low_discretion and not contested
        reason = []
        if man:  reason.append("mandat (" + ", ".join(s.strip("\\b") for s in man[:3]) + ")")
        if proc: reason.append("procediment/simbòlic")
        if contested: reason.append(f"PERÒ contestat ({share:.0%} en contra) → es manté")
        out.append({"id": d["id"], "propose_drop": propose,
                    "against_share": round(share, 2),
                    "reason": "; ".join(reason) or "—"})

    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False))

    proposed = {o["id"] for o in out if o["propose_drop"]}
    print(f"votable decisions scanned : {len(dec)}")
    print(f"auto-proposed drops       : {len(proposed)}")
    print(f"human flags (curator)     : {len(human)}")
    print(f"  agree (both drop)       : {len(proposed & human)}")
    print(f"  auto-only (auto drops, human didn't) : {sorted(proposed - human)}")
    print(f"  human-only (human dropped, auto kept): {sorted(human - proposed)}")
    print(f"\nwrote {OUT.relative_to(ROOT)} (proposals only — inert; human gate unchanged)")

if __name__ == "__main__":
    main()
