#!/usr/bin/env python3
"""
RIOT — build the committed decisions table from per-session extractions.

Merges data/raw/parsed_<code>.json (one file per session, facts-only LLM extraction)
into:
  data/decisions.json   — the one committed table (one row per decision)
  viewer/data.js        — same data as `window.DECISIONS` so viewer/index.html opens
                          by double-click (no server / no CORS issues)

Adds session metadata (date, source_url) to each row, canonicalises drifting party
tokens, and attaches a PROVISIONAL contested flag (decided==divided or rejected) —
clearly NOT the final `counts` (that's the Phase-2 human/▪heuristic step).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"

# Canonical party token (display) <- variants seen in actes. Extraction stays verbatim.
CANON = {
    "ERC-AM": "ERC", "ERC": "ERC",
    "JxR-CM": "JxR", "JxR": "JxR",
    "PSC-CP": "PSC", "PSC": "PSC",
    "CUP": "CUP", "VOX": "VOX", "PP": "PP", "A": "A",
}
def canon(token: str) -> str:
    if token.startswith("no_adscrit"):
        return token
    return CANON.get(token, token)

def main():
    sessions = {s["code"]: s for s in json.loads((RAW / "sessions.json").read_text())}
    rows = []
    for pf in sorted(RAW.glob("parsed_*.json")):
        code = pf.stem.replace("parsed_", "")
        sess = sessions.get(code, {})
        decisions = json.loads(pf.read_text())
        for d in decisions:
            party_votes = {canon(k): v for k, v in (d.get("party_votes") or {}).items()}
            contested = d.get("outcome") == "rejected" or d.get("decided") == "divided"
            rows.append({
                **d,
                "session_code": code,
                "date": sess.get("date"),
                "source_url": sess.get("detail_url"),
                "acta_url": sess.get("acta_url"),
                "party_votes_canon": party_votes,
                "contested_suggested": contested,   # PROVISIONAL — not the final `counts`
            })
    # newest first
    rows.sort(key=lambda r: (r.get("date") or "", r.get("session_code") or "",
                             str(r.get("point") or "")), reverse=True)

    out = {
        "generated_for": "riot.reus",
        "note": "Facts-only extraction. 'contested_suggested' is provisional, NOT the final counts.",
        "sessions_in_table": sorted({r["session_code"] for r in rows}),
        "n_decisions": len(rows),
        "decisions": rows,
    }
    (ROOT / "data" / "decisions.json").write_text(json.dumps(out, indent=2, ensure_ascii=False))
    # data.js sits next to index.html at repo root so the site works on GitHub Pages
    # (https fetch) AND by double-clicking index.html locally (file://, no CORS).
    (ROOT / "data.js").write_text("window.RIOT = " + json.dumps(out, ensure_ascii=False) + ";")

    contested = sum(1 for r in rows if r["contested_suggested"])
    print(f"built {len(rows)} decisions from {len(out['sessions_in_table'])} sessions")
    print(f"  provisional contested: {contested}  |  unanimous-ish: {len(rows)-contested}")
    print(f"  -> data/decisions.json and ./data.js")

if __name__ == "__main__":
    main()
