#!/usr/bin/env python3
"""
RIOT — Phase 0 data acquisition (riot.reus)

Enumerates Reus 'Ple Municipal' plenary sessions for the current mandate from the
AudioVideoActa portal, finds each session's final Acta (minutes) PDF, downloads it,
and extracts text with pdftotext.

Source: https://serveis.reus.cat/actes  (public). Council data is public.
Output:
  data/raw/sessions.json   — one record per session (code, date, detail/acta URLs)
  data/actas/<code>.pdf     — the minutes PDF
  data/actas/<code>.txt     — pdftotext -layout extraction

No external deps beyond the stdlib + pdftotext (poppler).
"""
import json, re, subprocess, sys, time, html
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen, Request

BASE = "https://serveis.reus.cat/actes"
PLE_TYPE_ID = "40287112575192c001575192edd3000d"  # "Ple Municipal" (vs Junta de Govern Local)
# Current mandate: council constituted June 2023. Widen a touch on the low side.
START = "01/06/23"
END = "31/12/26"

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
ACTAS = ROOT / "data" / "actas"
RAW.mkdir(parents=True, exist_ok=True)
ACTAS.mkdir(parents=True, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 (RIOT data fetch; public council data)"}


def get(url: str) -> str:
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers=UA), timeout=40) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            if attempt == 2:
                raise
            time.sleep(2)


def get_bytes(url: str) -> bytes:
    with urlopen(Request(url, headers=UA), timeout=90) as r:
        return r.read()


def list_session_detail_ids() -> list[str]:
    """Return detail IDs for all Ple sessions in the window, newest first."""
    q = urlencode({
        "searchText": "", "sessionTypeId": PLE_TYPE_ID,
        "startDate": START, "endDate": END, "search": "yes",
        "max": 500, "offset": 0, "sort": "sessionDate", "order": "desc",
    })
    page = get(f"{BASE}/session/fragmentCustom?{q}")
    ids, seen = [], set()
    for m in re.finditer(r"sessionDetail/([a-f0-9]+)", page):
        if m.group(1) not in seen:
            seen.add(m.group(1))
            ids.append(m.group(1))
    return ids


CAT_MONTHS = {
    "gener": 1, "febrer": 2, "març": 3, "marc": 3, "abril": 4, "maig": 5,
    "juny": 6, "juliol": 7, "agost": 8, "setembre": 9, "octubre": 10,
    "novembre": 11, "desembre": 12,
}

def acta_date_from_title(title: str) -> str | None:
    """Extract the ISO date a minutes document refers to, from its title.
    Final actas:  'PLE_11_2024_ORD_acta_240920.pdf'   -> 2024-09-20
    Draft actas:  'Esborrany Acta Ple de 21 de juny de 2024' -> 2024-06-21
    """
    t = html.unescape(title).strip()
    m = re.search(r"_acta_(\d{2})(\d{2})(\d{2})\b", t, re.IGNORECASE)
    if m:
        return f"20{m.group(1)}-{m.group(2)}-{m.group(3)}"
    # Catalan: "17 de maig de 2024" but "18 d'octubre de 2024" (vowel-initial months).
    m = re.search(r"(\d{1,2})\s+d(?:e\s+|['’])\s*([a-zàçé]+)\s+de\s+(\d{4})", t, re.IGNORECASE)
    if m and m.group(2).lower() in CAT_MONTHS:
        return f"{m.group(3)}-{CAT_MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"
    return None

def is_acta_title(title: str) -> tuple[bool, bool]:
    """(is_acta, is_final). 'Ordre del dia'/agenda and motion PDFs are not actas."""
    low = html.unescape(title).strip().lower()
    if re.search(r"_acta_\d{6}\b", low):
        return True, True
    if low.startswith("esborrany acta") or ("esborrany" in low and "acta ple" in low):
        return True, False
    if re.search(r"^acta\b", low) and "_agenda_" not in low:
        return True, True
    return False, False

def parse_detail(detail_id: str) -> dict:
    """Return the session's code/date plus EVERY acta-type document found on its
    page (with the date each refers to). Acta assignment to sessions is done
    globally afterwards, because a session's own minutes are often hosted on a
    LATER session's page (submitted there for approval)."""
    page = get(f"{BASE}/session/sessionDetail/{detail_id}")
    code_m = re.search(r"PLE_\d+_\d+_[A-Z]+", page)
    # Session date: prefer the agenda filename (…_agenda_YYMMDD.pdf) — unambiguous.
    date_iso = None
    ag = re.search(r"_agenda_(\d{2})(\d{2})(\d{2})\b", page)
    if ag:
        date_iso = f"20{ag.group(1)}-{ag.group(2)}-{ag.group(3)}"
    else:
        dm = re.search(r"(\d{2})/(\d{2})/(\d{4})", page)
        if dm:
            date_iso = f"{dm.group(3)}-{dm.group(2)}-{dm.group(1)}"

    actas = []
    for dl_id, title in re.findall(
            r'href="/actes/session/downloadItem/([a-f0-9]+)"[^>]*?title="([^"]*)"', page):
        is_acta, is_final = is_acta_title(title)
        if is_acta:
            actas.append({"dl_id": dl_id, "title": html.unescape(title).strip(),
                          "is_final": is_final, "refers_to": acta_date_from_title(title)})
    return {
        "code": code_m.group(0) if code_m else detail_id,
        "date": date_iso,
        "detail_id": detail_id,
        "detail_url": f"{BASE}/session/sessionDetail/{detail_id}",
        "actas_on_page": actas,
    }

def assign_actas(sessions: list[dict]) -> None:
    """Globally pick, for each session, the best acta document whose referenced
    date == the session date. Prefer final over draft. Mutates each session dict
    to add acta_download_id / acta_url / acta_is_draft."""
    by_date: dict[str, dict] = {}   # date -> best acta doc
    for s in sessions:
        for a in s["actas_on_page"]:
            d = a["refers_to"]
            if not d:
                continue
            cur = by_date.get(d)
            if cur is None or (a["is_final"] and not cur["is_final"]):
                by_date[d] = a
    for s in sessions:
        a = by_date.get(s["date"])
        s["acta_download_id"] = a["dl_id"] if a else None
        s["acta_url"] = f"{BASE}/session/downloadItem/{a['dl_id']}" if a else None
        s["acta_is_draft"] = bool(a) and not a["is_final"]
        s.pop("actas_on_page", None)


def main():
    print("Enumerating Ple sessions…", file=sys.stderr)
    detail_ids = list_session_detail_ids()
    print(f"  {len(detail_ids)} sessions", file=sys.stderr)

    sessions = []
    for i, did in enumerate(detail_ids, 1):
        rec = parse_detail(did)
        sessions.append(rec)
        time.sleep(0.3)

    assign_actas(sessions)   # global date-matched assignment (fixes prior-session drafts)
    for rec in sessions:
        flag = "DRAFT" if rec["acta_is_draft"] else ("ok" if rec["acta_url"] else "NO ACTA")
        print(f"  {rec['code']:20} {rec['date']}  {flag}", file=sys.stderr)

    (RAW / "sessions.json").write_text(json.dumps(sessions, indent=2, ensure_ascii=False))
    print(f"\nWrote {RAW/'sessions.json'}", file=sys.stderr)

    def internal_date(txt: Path) -> str | None:
        head = txt.read_text(errors="replace")[:2500]
        m = re.search(r"Data[:\.]?\s*(\d{2})/(\d{2})/(\d{4})", head)
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None

    for rec in sessions:
        if not rec["acta_url"]:
            continue
        pdf = ACTAS / f"{rec['code']}.pdf"
        txt = ACTAS / f"{rec['code']}.txt"
        # Re-download if missing OR if a cached file's internal date doesn't match.
        if txt.exists() and internal_date(txt) == rec["date"]:
            continue
        try:
            pdf.write_bytes(get_bytes(rec["acta_url"]))
            subprocess.run(["pdftotext", "-layout", str(pdf), str(txt)], check=True)
            idate = internal_date(txt)
            ok = "OK" if idate == rec["date"] else f"!! internal={idate}"
            print(f"  fetched {rec['code']} ({pdf.stat().st_size//1024} KB) {ok}", file=sys.stderr)
        except Exception as e:
            print(f"  FAILED {rec['code']}: {e}", file=sys.stderr)
        time.sleep(0.4)

    # Final integrity check.
    bad = [r["code"] for r in sessions
           if (ACTAS / f"{r['code']}.txt").exists()
           and internal_date(ACTAS / f"{r['code']}.txt") not in (r["date"], None)]
    have = sum(1 for r in sessions if (ACTAS / f"{r['code']}.txt").exists())
    print(f"\nDone. {have}/{len(sessions)} actas extracted.", file=sys.stderr)
    if bad:
        print(f"  STILL MISMATCHED ({len(bad)}): {', '.join(bad)}", file=sys.stderr)
    else:
        print("  all cached actas' internal dates match their session date.", file=sys.stderr)


if __name__ == "__main__":
    main()
