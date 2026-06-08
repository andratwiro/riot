#!/usr/bin/env python3
"""
RIOT — plenary item classifier (the structural / "votability" layer).

Maps each agenda point to a canonical `kind` and a derived `votable` flag, so the
card stack can show only real decisions (`votable=True`) while the raw verification
view keeps everything (donar compte, precs, preguntes, info...).

This is deliberately separate from `counts` (the *political* contested-filter,
Phase 2). Two orthogonal questions:
  - votable?  -> is this a DECISION at all (structural). Set here.
  - counts?   -> among decisions, is it CONTESTED/divisive (political). Set later.

Legal backbone: ROF (RD 2568/1986) art. 97 + parte resolutiva / parte de control
(LRBRL art. 46.2); Reus tunes details in its ROM (in force 2020). See
docs/PLENARY_TAXONOMY.md for the full taxonomy, detection rules and edge cases.

Used by build_table.py. Run directly to print a kind histogram over data/raw/parsed_*.json
(`python3 scripts/classify.py`) — handy to sanity-check capture across all plens.
"""
import re

# Canonical closed vocabulary. votable = does it reach the card deck?
KINDS = {
    # --- part resolutiva (decisions — votable) ---
    "dictamen":     {"votable": True,  "part": "resolutiva"},  # govern proposal, via comissió informativa
    "proposicio":   {"votable": True,  "part": "resolutiva"},  # resolutive item, groups
    "mocio":        {"votable": True,  "part": "resolutiva"},  # mostly opposition; voted
    "ratificacio":  {"votable": True,  "part": "resolutiva"},  # ratify a decree/urgency that carries a real vote
    "declaracio":   {"votable": True,  "part": "resolutiva"},  # declaració institucional (often per assentiment)
    # --- part de control + tràmit (NOT a for/against decision — raw view only) ---
    "donar_compte": {"votable": False, "part": "control"},     # dació de compte: "es dóna per assabentat", no vote
    "info":         {"votable": False, "part": "control"},     # Informació de l'Alcaldia
    "acta":         {"votable": False, "part": "tramit"},      # aprovació de l'acta anterior
    "prec":         {"votable": False, "part": "control"},     # ruego: debated, "en cap cas sotmès a votació"
    "pregunta":     {"votable": False, "part": "control"},     # question to government; gets an answer, not a vote
    "altres":       {"votable": False, "part": "altres"},      # unclassified fallback (review)
}

# Normalise the verbatim `type` token from extraction -> canonical kind.
_TYPE_ALIASES = {
    "proposta": "dictamen", "dictamen": "dictamen", "dictàmen": "dictamen",
    "proposicio": "proposicio", "proposició": "proposicio",
    "mocio": "mocio", "moció": "mocio",
    "ratificacio": "ratificacio", "ratificació": "ratificacio",
    "declaracio": "declaracio", "declaració": "declaracio",
    "declaracio_institucional": "declaracio",
    "donar_compte": "donar_compte", "dacio": "donar_compte", "dació": "donar_compte",
    "info": "info", "informacio": "info", "informació": "info",
    "acta": "acta",
    "prec": "prec", "precs": "prec",
    "pregunta": "pregunta", "preguntes": "pregunta",
}

# Title/verb signals (used when `type` is missing or generic). Order matters: first hit wins.
_TITLE_RULES = [
    ("acta",         re.compile(r"aprovaci.{0,3}\s+de\s+l.?acta", re.I)),
    ("info",         re.compile(r"informaci.{0,3}\s+de\s+l.?alcaldia", re.I)),
    ("donar_compte", re.compile(r"\bdonar\s+compte\b|\bes\s+d[oó]na?\s+per\s+assabentat\b", re.I)),
    ("ratificacio",  re.compile(r"\bratific", re.I)),
    ("declaracio",   re.compile(r"declaraci.{0,3}\s+institucional", re.I)),
    ("mocio",        re.compile(r"^\s*moci[oó]\b", re.I)),
    ("proposicio",   re.compile(r"^\s*proposici[oó]\b", re.I)),
    ("pregunta",     re.compile(r"\bpregunta\b", re.I)),
    ("prec",         re.compile(r"^\s*prec\b", re.I)),
]


def _has_real_tally(d) -> bool:
    """A recorded vote count or a decided outcome => an actual decision happened."""
    t = d.get("tally") or {}
    if any(t.get(k) not in (None, "") for k in ("for", "against", "abstain")):
        return True
    return d.get("outcome") in ("approved", "rejected") or d.get("decided") in ("unanimous", "divided")


def classify(d) -> dict:
    """Return {'kind', 'votable', 'part'} for one parsed decision dict."""
    kind = _TYPE_ALIASES.get((d.get("type") or "").strip().lower())
    if kind is None:
        title = d.get("title") or ""
        for k, rx in _TITLE_RULES:
            if rx.search(title):
                kind = k
                break
    if kind is None:
        kind = "altres"

    meta = KINDS[kind]
    votable = meta["votable"]
    # Grounding override (the honest rule): if the acta records an actual vote, it's a
    # decision regardless of how the agenda labelled it — and vice-versa, a control item
    # with no tally is never votable. This keeps `votable` true to what happened.
    if _has_real_tally(d):
        votable = True
    elif meta["part"] in ("control", "tramit"):
        votable = False

    return {"kind": kind, "votable": votable, "part": meta["part"]}


if __name__ == "__main__":
    import json, collections
    from pathlib import Path
    raw = Path(__file__).resolve().parent.parent / "data" / "raw"
    hist, votable = collections.Counter(), collections.Counter()
    n = 0
    for pf in sorted(raw.glob("parsed_*.json")):
        for d in json.loads(pf.read_text()):
            c = classify(d); n += 1
            hist[c["kind"]] += 1
            votable["votable" if c["votable"] else "non-votable"] += 1
    print(f"{n} parsed decisions across {len(list(raw.glob('parsed_*.json')))} sessions\n")
    for k, c in hist.most_common():
        print(f"  {c:4}  {k:13} (votable={KINDS[k]['votable']})")
    print(f"\n  -> {votable['votable']} votable (reach cards) | {votable['non-votable']} non-votable (raw view only)")
