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
import json, hashlib, re
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

# Party display metadata (token -> name, brand colour, logo file or null=colored fallback).
# Affinity bar shows these, in this order. Minor groups (A, no_adscrit_*) still count in
# party_votes but aren't given a logo slot here.
PARTY_META = [
    {"token": "PSC", "name": "PSC",  "color": "#e2001a", "logo": "assets/logos/PSC.svg"},
    {"token": "JxR", "name": "Junts", "color": "#00c3b2", "logo": "assets/logos/JxR.svg"},
    {"token": "ERC", "name": "ERC",  "color": "#ffb232", "logo": "assets/logos/ERC_mark.svg"},
    {"token": "CUP", "name": "CUP",  "color": "#fff200", "logo": "assets/logos/CUP.png"},
    {"token": "VOX", "name": "Vox",  "color": "#63be21", "logo": "assets/logos/VOX.svg"},
    {"token": "PP",  "name": "PP",   "color": "#1a4f8b", "logo": None},
]

def main():
    sessions = {s["code"]: s for s in json.loads((RAW / "sessions.json").read_text())}
    # Curator "no val la pena votar" flags — hidden from the voting deck (but kept in the
    # table for transparency, and still reachable via the app's flagged-items view).
    cm = ROOT / "data" / "curator_marks.json"
    curator_drop = {m["id"] for m in json.loads(cm.read_text())} if cm.exists() else set()
    # Auto-detected low-discretion PROPOSALS (scripts/detect_discretion.py). These never hide
    # anything by themselves — they surface in-app as "proposem no votar?" for the curator to
    # confirm (→ becomes a curator_mark → hides) or dismiss (→ curator_dismissed, stops nagging).
    ad = ROOT / "data" / "auto_discretion.json"
    auto_drop = {a["id"] for a in json.loads(ad.read_text()) if a.get("propose_drop")} if ad.exists() else set()
    cd = ROOT / "data" / "curator_dismissed.json"
    dismissed = {x for x in json.loads(cd.read_text())} if cd.exists() else set()
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
            contested = d.get("outcome") == "rejected" or d.get("decided") == "divided"
            rows.append({
                **d,
                "session_code": code,
                "date": sess.get("date"),
                "source_url": sess.get("detail_url"),
                "acta_url": sess.get("acta_url"),
                "party_votes_canon": party_votes,
                "contested_suggested": contested,   # PROVISIONAL — not the final `counts`
                "curator_drop": d["id"] in curator_drop,   # confirmed → hidden from deck
                # auto proposed it, you haven't confirmed or dismissed yet → show suggestion in-app
                "auto_suggest": (d["id"] in auto_drop and d["id"] not in curator_drop
                                 and d["id"] not in dismissed),
                # --- human layer (Phase 1; reviewed separately, never overwrites facts) ---
                "headline": ex.get("headline"),
                "human_body": ex.get("body"),
                "source_brief": ex.get("brief"),   # voiced extended summary (human dive-in)
                # deep = two parts: facts (neutral, cited — the ONLY deep the AI proxy reads)
                # + lectura (analyst inference, human-facing only, never fed to the proxy)
                "deep_facts": ex.get("deep_facts") or ex.get("deep"),
                "deep_lectura": ex.get("deep_lectura"),
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
        "n_explained": sum(1 for r in rows if r["explained"]),
        "decisions": rows,
    }
    (ROOT / "data" / "decisions.json").write_text(json.dumps(out, indent=2, ensure_ascii=False))
    # Per-city bundle: the viewer loads cities/<id>/data.js based on ?city=. Reus is the
    # default instance. (Works on GitHub Pages over https AND by double-clicking locally.)
    data_js = "window.RIOT = " + json.dumps(out, ensure_ascii=False) + ";"
    out_js = ROOT / "cities" / "reus" / "data.js"
    out_js.parent.mkdir(parents=True, exist_ok=True)
    out_js.write_text(data_js)

    dropped = sum(1 for r in rows if r.get("curator_drop"))
    print(f"  curator-dropped (hidden from deck): {dropped}  |  in voting deck: {len(rows)-dropped}")
    contested = sum(1 for r in rows if r["contested_suggested"])
    print(f"built {len(rows)} decisions from {len(out['sessions_in_table'])} sessions")
    print(f"  provisional contested: {contested}  |  unanimous-ish: {len(rows)-contested}")
    print(f"  -> data/decisions.json and cities/reus/data.js")

if __name__ == "__main__":
    main()
