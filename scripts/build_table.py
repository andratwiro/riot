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
from classify import classify  # structural layer: kind + votable (see docs/PLENARY_TAXONOMY.md)

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

# Party display metadata (token -> name, brand colour, logo file or null=colored fallback).
# Affinity bar shows these, in this order. Minor groups (A, no_adscrit_*) still count in
# party_votes but aren't given a logo slot here.
PARTY_META = [
    {"token": "PSC", "name": "PSC",  "color": "#e2001a", "logo": "assets/logos/PSC.svg"},
    {"token": "JxR", "name": "Junts", "color": "#00c3b2", "logo": "assets/logos/JxR.svg"},
    {"token": "ERC", "name": "ERC",  "color": "#ffb232", "logo": "assets/logos/ERC.svg"},
    {"token": "CUP", "name": "CUP",  "color": "#fff200", "logo": "assets/logos/CUP.png"},
    {"token": "VOX", "name": "Vox",  "color": "#63be21", "logo": "assets/logos/VOX.svg"},
    {"token": "PP",  "name": "PP",   "color": "#1a4f8b", "logo": None},
]

def main():
    sessions = {s["code"]: s for s in json.loads((RAW / "sessions.json").read_text())}
    # Load human-layer explanations, keyed by decision id.
    explained = {}
    for ef in RAW.glob("explained_*.json"):
        for e in json.loads(ef.read_text()):
            explained[e["id"]] = e
    rows = []
    for pf in sorted(RAW.glob("parsed_*.json")):
        code = pf.stem.replace("parsed_", "")
        sess = sessions.get(code, {})
        decisions = json.loads(pf.read_text())
        for d in decisions:
            ex = explained.get(d["id"], {})
            party_votes = {canon(k): v for k, v in (d.get("party_votes") or {}).items()}
            cls = classify(d)            # {kind, votable, part} — the structural layer
            # contested only has meaning for things that were actually decided (votable).
            contested = cls["votable"] and (
                d.get("outcome") == "rejected" or d.get("decided") == "divided")
            rows.append({
                **d,
                "session_code": code,
                "date": sess.get("date"),
                "source_url": sess.get("detail_url"),
                "acta_url": sess.get("acta_url"),
                "party_votes_canon": party_votes,
                # --- structural layer: is this even a decision? gates the card deck ---
                "kind": cls["kind"],
                "votable": cls["votable"],
                "part": cls["part"],
                "contested_suggested": contested,   # PROVISIONAL — not the final `counts`
                # --- human layer (Phase 1; reviewed separately, never overwrites facts) ---
                "headline": ex.get("headline"),
                "human_body": ex.get("body"),
                "topic": ex.get("topic"),
                "stake": ex.get("stake"),
                "explained": bool(ex),
            })
    # newest first
    rows.sort(key=lambda r: (r.get("date") or "", r.get("session_code") or "",
                             str(r.get("point") or "")), reverse=True)

    out = {
        "generated_for": "riot.reus",
        "note": "Facts extracted from actes; 'headline'/'human_body' are a reviewed human layer.",
        "parties": PARTY_META,
        "sessions_in_table": sorted({r["session_code"] for r in rows}),
        "n_decisions": len(rows),
        "n_votable": sum(1 for r in rows if r["votable"]),
        "n_explained": sum(1 for r in rows if r["explained"]),
        "decisions": rows,
    }
    (ROOT / "data" / "decisions.json").write_text(json.dumps(out, indent=2, ensure_ascii=False))
    # data.js sits next to index.html at repo root so the site works on GitHub Pages
    # (https fetch) AND by double-clicking index.html locally (file://, no CORS).
    (ROOT / "data.js").write_text("window.RIOT = " + json.dumps(out, ensure_ascii=False) + ";")

    contested = sum(1 for r in rows if r["contested_suggested"])
    votable = out["n_votable"]
    print(f"built {len(rows)} agenda points from {len(out['sessions_in_table'])} sessions")
    print(f"  votable (reach cards): {votable}  |  non-votable (raw view only): {len(rows)-votable}")
    print(f"  provisional contested: {contested}  |  unanimous-ish: {votable-contested}")
    print(f"  -> data/decisions.json and ./data.js")

if __name__ == "__main__":
    main()
