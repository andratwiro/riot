#!/usr/bin/env python3
"""
fetch_sessions_bxl.py — download the Brussels-Capital Parliament plenary CRIs.

The regional Parliament publishes a bilingual FR/NL "compte rendu intégral" (CRI)
per plenary session at a predictable weblex URL:

    http://weblex.brussels/data/crb/cri/<session>/<NNNNN>/images.pdf

(crb = regional Parliament, cri = compte rendu intégral, session like "2025-26",
zero-padded sequence number.) This script walks the sequence for a session, downloads
each existing CRI PDF to data/brussels/cri_pdf/, and converts it to text with
pdftotext -layout into data/brussels/cri_txt/ — the source layer the extractor reads.

PDFs are .gitignored (large, re-fetchable here); the .txt audit trail is committed.

Deps: the `pdftotext` binary (poppler). Run: python3 scripts/fetch_sessions_bxl.py [--session 2025-26] [--max 60]
"""
import argparse, subprocess, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "data" / "brussels" / "cri_pdf"
TXT = ROOT / "data" / "brussels" / "cri_txt"
URL = "http://weblex.brussels/data/crb/cri/{session}/{num:05d}/images.pdf"


def fetch(session, n):
    url = URL.format(session=session, num=n)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "riot-bxl/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        if len(data) < 2000 or not data[:5] == b"%PDF-":
            return False
        (PDF / f"{n:05d}.pdf").write_bytes(data)
        return True
    except (urllib.error.HTTPError, urllib.error.URLError):
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--session", default="2025-26")
    ap.add_argument("--max", type=int, default=60, help="highest sequence number to probe")
    args = ap.parse_args()
    PDF.mkdir(parents=True, exist_ok=True)
    TXT.mkdir(parents=True, exist_ok=True)
    got = 0
    for n in range(1, args.max + 1):
        pdf = PDF / f"{n:05d}.pdf"
        if not pdf.exists():
            if not fetch(args.session, n):
                continue
        subprocess.run(["pdftotext", "-layout", str(pdf), str(TXT / f"{n:05d}.txt")], check=True)
        got += 1
        print(f"  {n:05d}: ok")
    print(f"fetched/converted {got} CRIs for session {args.session} -> data/brussels/cri_txt/")


if __name__ == "__main__":
    main()
