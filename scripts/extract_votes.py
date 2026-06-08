#!/usr/bin/env python3
"""
RIOT — vote-block extractor (first pass / corpus survey).

Reads the pdftotext output of each session's Acta and finds every vote outcome,
parsing the per-party / per-councillor breakdown where present. The goal of this
pass is to QUANTIFY the corpus (how many decisions, contested vs unanimous) and to
validate the parse template before wiring titles + context into the final table.

Outcome types:
  unanimitat / assentiment  -> unanimous   (counts=false candidate)
  aprova amb <tally>        -> approved, divided
  rebutja amb <tally>       -> rejected (always contested — a defeated motion)

A <tally> looks like:
  "23 vots a favor: ((PSC-CP): Sres./Srs. A, B; (JxR-CM): C, D) i 3 abstencions: (CUP): ..."
We capture, per outcome, the for/against/abstain counts and which party groups fell
in each bucket.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACTAS = ROOT / "data" / "actas"
RAW = ROOT / "data" / "raw"

# Known current-mandate party-group tokens (as they appear in actes).
PARTIES = ["PSC-CP", "JxR-CM", "JxR", "ERC", "CUP", "VOX", "PP", "Cs", "CS"]

# Join hard-wrapped lines into one stream so multi-line vote blocks are contiguous.
def normalize(text: str) -> str:
    text = text.replace("’", "'")
    # collapse runs of whitespace/newlines into single spaces
    return re.sub(r"\s+", " ", text)

# The vote block ends at the next sentence that is NOT an abbreviation. Catalan
# abbreviations (Sr., Sra., Sres., Srs.) embed periods, so we can't stop at the
# first ".". Instead capture a generous window after the verb and let the bucket
# parser read the for/against/abstain structure out of it.
VOTE_RE = re.compile(
    r"Sotmes(?:a|os|es|ès)\b[^.]{0,80}?votació[^.]{0,40}?"
    r"(?P<verb>s'aprov\w+|es rebut\w+|es desestim\w+)"
    r"(?P<rest>.{0,500})",
    re.IGNORECASE)

def parse_tally(rest: str) -> dict:
    """Pull for/against/abstain counts and the party groups in each bucket."""
    out = {"unanimous": False, "for": None, "against": None, "abstain": None,
           "for_parties": [], "against_parties": [], "abstain_parties": []}
    low = rest.lower()
    if "unanimitat" in low or "assentiment" in low:
        out["unanimous"] = True
        return out

    def grab(label_variants):
        # number immediately before a bucket label, e.g. "23 vots a favor"
        for lab in label_variants:
            m = re.search(r"(\d+)\s+" + lab, rest, re.IGNORECASE)
            if m:
                return int(m.group(1))
        return None

    out["for"] = grab([r"vots?\s+a\s+favor", r"a\s+favor"])
    out["against"] = grab([r"vots?\s+en\s+contra", r"en\s+contra"])
    out["abstain"] = grab([r"abstenci\w+"])

    # Which parties appear in each bucket: split rest into for / against / abstain spans.
    # Buckets are introduced by "a favor", "en contra", "absten...".
    markers = [(m.start(), m.group(0).lower()) for m in
               re.finditer(r"a favor|en contra|abstenci\w+", rest, re.IGNORECASE)]
    markers.append((len(rest), "end"))
    for i in range(len(markers) - 1):
        span = rest[markers[i][0]:markers[i + 1][0]]
        found = [p for p in ("PSC-CP","JxR-CM","ERC","CUP","VOX","PP","Cs") if p in span]
        # de-dup keep order
        seen=set(); found=[p for p in found if not (p in seen or seen.add(p))]
        kind = markers[i][1]
        if "favor" in kind: out["for_parties"] = found
        elif "contra" in kind: out["against_parties"] = found
        elif "absten" in kind: out["abstain_parties"] = found
    return out

def classify(verb: str, tally: dict) -> str:
    if "rebut" in verb.lower() or "desestim" in verb.lower():
        return "rejected"          # a defeated motion is inherently contested
    if tally["unanimous"]:
        return "unanimous"
    # Explicit-count approvals: divided only if there is real opposition
    # (someone voted against or abstained). All-for is unanimous in effect.
    has_opposition = bool(tally["against"]) or bool(tally["abstain"])
    return "approved-divided" if has_opposition else "approved-unanimous-effect"

def main():
    sessions = json.loads((RAW / "sessions.json").read_text())
    by_code = {s["code"]: s for s in sessions}
    all_outcomes = []
    per_session = []
    for txt in sorted(ACTAS.glob("*.txt")):
        code = txt.stem
        stream = normalize(txt.read_text(encoding="utf-8", errors="replace"))
        outcomes = []
        for m in VOTE_RE.finditer(stream):
            verb = m.group("verb")
            rest = m.group("rest")
            # Don't let the window bleed into the next decision.
            cut = re.search(r"Sotmes(?:a|os|es|ès)\b", rest)
            if cut:
                rest = rest[:cut.start()]
            tally = parse_tally(rest)
            kind = classify(verb, tally)
            outcomes.append({"kind": kind, **tally,
                             "snippet": re.sub(r"\s+", " ", m.group(0))[:240]})
        per_session.append((code, by_code.get(code, {}).get("date"), outcomes))
        all_outcomes.extend(outcomes)

    # Survey
    from collections import Counter
    kinds = Counter(o["kind"] for o in all_outcomes)
    contested = [o for o in all_outcomes if o["kind"] in ("rejected", "approved-divided")]
    print("=== RIOT corpus survey ===")
    print(f"sessions with text : {len(per_session)}")
    print(f"total vote outcomes: {len(all_outcomes)}")
    for k, n in kinds.most_common():
        print(f"  {k:18}: {n}")
    effectively_unanimous = kinds.get('unanimous',0) + kinds.get('approved-unanimous-effect',0)
    print(f"\ncontested (divided or rejected) -> counts=true candidates : {len(contested)}")
    print(f"unanimous (literal + all-for)   -> counts=false candidates: {effectively_unanimous}")
    # show a few contested examples
    print("\n--- sample contested outcomes ---")
    for o in contested[:6]:
        print(f"[{o['kind']}] for={o['for']}({','.join(o['for_parties'])}) "
              f"against={o['against']}({','.join(o['against_parties'])}) "
              f"abst={o['abstain']}({','.join(o['abstain_parties'])})")
        print(f"   {o['snippet'][:160]}")

    (RAW / "vote_outcomes.json").write_text(
        json.dumps([{"code": c, "date": d, "outcomes": o} for c, d, o in per_session],
                   indent=2, ensure_ascii=False))
    print(f"\nWrote {RAW/'vote_outcomes.json'}")

if __name__ == "__main__":
    main()
