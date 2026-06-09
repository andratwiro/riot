#!/usr/bin/env python3
"""
extract_votes_bxl.py — parse roll-call (nominal) votes from Brussels Parliament CRIs.

The Brussels-Capital regional Parliament publishes a bilingual "compte rendu intégral"
(CRI) per plenary session. Substantive texts that get a roll-call ("vote nominatif" /
"naamstemming") carry a "DÉTAIL DU VOTE NOMINATIF" annex listing every member by name
under Oui / Non / Abstention. This script parses those blocks into structured per-vote
records (the per-MEMBER layer). build_table_bxl.py later maps members -> political
groups (data/brussels/roster.json) to get the per-GROUP votes RIOT compares.

Input:  data/brussels/cri_txt/<NNNNN>.txt   (pdftotext -layout of the weblex CRI PDFs)
Output: data/brussels/votes_raw.json        (list of {cri,date,vote_no,subject,doc_ref,
                                              kind,segment,oui[],non[],abst[]})

Run:  python3 scripts/extract_votes_bxl.py
"""
import json, re, glob
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TXT = ROOT / "data" / "brussels" / "cri_txt"
OUT = ROOT / "data" / "brussels" / "votes_raw.json"

VOTE_MARK = re.compile(r"STEMMING\s+(\d+)\s*/\s*VOTE\s+\d+")
H_OUI = re.compile(r"^\s*Ja\s+(\d+)\s+Oui\s*$")
H_NON = re.compile(r"^\s*Neen\s+(\d+)\s+Non\s*$")
H_ABS = re.compile(r"^\s*Onthoudingen\s+(\d+)\s+Abstentions\s*$")
# Subject like: "PPR violences gynécologiques (A-29) - Ensemble (Majorité absolue)"
KIND = {"PPR": "Proposition de résolution", "PJO": "Projet d'ordonnance",
        "PPO": "Proposition d'ordonnance", "PJ": "Projet", "PO": "Projet d'ordonnance",
        "P": "Proposition", "MOTION": "Motion", "Urgence": "Demande d'urgence"}
DATE_RE = re.compile(r"(LUNDI|MARDI|MERCREDI|JEUDI|VENDREDI)\s+(\d+)\s+([A-ZÉÛ]+)\s+(202\d)")
MONTHS = {"JANVIER":"01","FÉVRIER":"02","MARS":"03","AVRIL":"04","MAI":"05","JUIN":"06",
          "JUILLET":"07","AOÛT":"08","SEPTEMBRE":"09","OCTOBRE":"10","NOVEMBRE":"11","DÉCEMBRE":"12"}


def clean_names(chunk):
    """Comma-separated member names, possibly wrapped across lines. Return clean list."""
    s = " ".join(chunk)
    s = s.replace("- ", "-").replace("- ", "-")   # de-hyphenate line-wrapped names
    out = []
    for nm in s.split(","):
        nm = re.sub(r"\s+", " ", nm).strip().strip(".").strip()
        if not nm:
            continue
        # plausible "First Last" (2-5 tokens, starts uppercase, no digits)
        if 2 <= len(nm.split()) <= 6 and re.match(r"^[A-ZÀ-ÿ][\w'’\-. ]+$", nm) and not any(c.isdigit() for c in nm):
            out.append(nm)
    return out


def parse_subject(line):
    """-> (kind, doc_ref, segment, clean_subject) from a DÉTAIL subject line."""
    raw = re.sub(r"\s+", " ", line).strip()
    raw = re.sub(r"\s*\(Majorité absolue\)\s*$", "", raw)
    doc = re.search(r"\(A-?\s?(\d+)\)", raw)
    doc_ref = f"A-{doc.group(1)}" if doc else None
    seg = None
    m = re.search(r"-\s*(Ensemble|Amendement\s*\d+|Art\.?\s*[\w,. +]+|Tiret\s*\d+)\s*$", raw)
    if m:
        seg = m.group(1).strip()
    kind = None
    mk = re.match(r"^(PPR|PJO|PPO|PJ|PO|P|MOTION|Urgence)\b", raw)
    if mk:
        kind = mk.group(1)
    elif raw.startswith("Ordre du jour pur"):
        kind = "ODJPS"   # ordre du jour pur et simple (procedural)
    elif raw.startswith("Motion de confiance"):
        kind = "CONF"
    return kind, doc_ref, seg, raw


def session_date(txt):
    m = DATE_RE.search(txt)
    if not m:
        return None
    d, mon, y = m.group(2), m.group(3), m.group(4)
    return f"{y}-{MONTHS.get(mon,'00')}-{int(d):02d}"


def parse_cri(path):
    txt = path.read_text(encoding="utf-8")
    # The roll-call blocks ("STEMMING N / VOTE N") live in the detail annex. The
    # "DÉTAIL DU VOTE NOMINATIF" header is NOT always present, so anchor on the markers.
    if not VOTE_MARK.search(txt):
        return []
    date = session_date(txt)
    lines = txt.splitlines()
    votes = []
    cur = None
    bucket = None       # 'oui' | 'non' | 'abst'
    buf = []

    def flush():
        if cur is not None and bucket is not None and buf:
            cur[bucket] += clean_names(buf)
        buf.clear()

    j = 0
    while j < len(lines):
        ln = lines[j]
        if VOTE_MARK.search(ln):
            flush()
            if cur:
                votes.append(cur)
            # subject = first non-empty FR line after the marker (NL line follows it)
            subj = ""
            k = j + 1
            while k < len(lines) and not H_OUI.match(lines[k]):
                t = lines[k].strip()
                if t and t[0].isalpha():
                    subj = t
                    break
                k += 1
            kind, doc_ref, seg, clean = parse_subject(subj)
            cur = {"cri": path.stem, "date": date, "vote_no": int(VOTE_MARK.search(ln).group(1)),
                   "subject": clean, "kind": kind, "doc_ref": doc_ref, "segment": seg,
                   "oui": [], "non": [], "abst": []}
            bucket = None
            j = k
            continue
        if H_OUI.match(ln):
            flush(); bucket = "oui"; j += 1; continue
        if H_NON.match(ln):
            flush(); bucket = "non"; j += 1; continue
        if H_ABS.match(ln):
            flush(); bucket = "abst"; j += 1; continue
        # stop collecting at annex/section boundaries
        if "SÉANCE PLÉNIÈRE" in ln or "ANNEXES" in ln or re.match(r"^\s*\d{2,4}\s*$", ln):
            flush(); bucket = None; j += 1; continue
        if bucket:
            if ln.strip():
                buf.append(ln.strip())
            else:
                flush()
        j += 1
    flush()
    if cur:
        votes.append(cur)
    return votes


def main():
    all_votes = []
    for f in sorted(TXT.glob("*.txt")):
        all_votes.extend(parse_cri(f))
    OUT.write_text(json.dumps(all_votes, ensure_ascii=False, indent=2))
    # quick report
    ensemble = [v for v in all_votes if v["segment"] == "Ensemble" or v["kind"] in ("MOTION", "CONF", "Urgence")]
    print(f"parsed {len(all_votes)} nominal votes across {len(list(TXT.glob('*.txt')))} CRIs")
    print(f"  substantive (Ensemble / motion / urgence): {len(ensemble)}")
    for v in ensemble:
        ok = "ok" if (len(v["oui"]) + len(v["non"]) + len(v["abst"])) > 0 else "EMPTY"
        print(f"  [{v['cri']} {v['date']}] {v['subject'][:64]:64s} "
              f"P{len(v['oui'])}/C{len(v['non'])}/A{len(v['abst'])} {ok}")


if __name__ == "__main__":
    main()
