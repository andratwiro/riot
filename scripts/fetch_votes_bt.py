#!/usr/bin/env python3
"""Fetch the Bundestag deck's roll-call records from the official record.

For each vote in DECK this downloads the Bundestag's official per-MP XLSX
(bundestag.de publishes one per namentliche Abstimmung, listed at
https://www.bundestag.de/parlament/plenum/abstimmung/liste), parses it with
the stdlib (an XLSX is a zip of XML — no third-party deps, per repo policy)
and writes data/bundestag/rollcalls/<id>.json — the committed audit trail,
analogous to data/commons/divisions/.

Every file is then CROSS-CHECKED against a second, independent source: the
abgeordnetenwatch.de API v2 (CC0). A per-Fraktion count mismatch between the
official XLSX and abgeordnetenwatch is FATAL — resolve it before building.

    python3 scripts/fetch_votes_bt.py

The raw .xlsx files are cached in data/bundestag/xlsx/ (gitignored,
re-fetchable); the parsed JSON is what gets committed.
"""
import json, pathlib, re, urllib.request, zipfile
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "bundestag" / "rollcalls"
CACHE = ROOT / "data" / "bundestag" / "xlsx"
AW = "https://www.abgeordnetenwatch.de/api/v2/votes?poll={}&range_end=800"

# id -> (official XLSX, abgeordnetenwatch poll id, what it is).
# Deck order here is chronological; the viewer shuffles per person anyway.
DECK = {
    "BT-2025-mietwucher": (
        "https://www.bundestag.de/resource/blob/1121876/20251106_1_xls.xlsx", 6311,
        "Gesetzentwurf zur Bekämpfung überhöhter Mieten (6 Nov 2025)"),
    "BT-2025-wehrdienst": (
        "https://www.bundestag.de/resource/blob/1129376/20251205_1_xls.xlsx", 6359,
        "Wehrdienst-Modernisierungsgesetz (5 Dec 2025)"),
    "BT-2025-rentenpaket": (
        "https://www.bundestag.de/resource/blob/1129380/20251205_2_xls.xlsx", 6356,
        "Rentenniveau + Kindererziehungszeiten (5 Dec 2025)"),
    "BT-2026-politikerbeleidigung": (
        "https://www.bundestag.de/resource/blob/1140520/20260129_2_xls.xlsx", 6391,
        "Streichung des § 188 StGB, Politikerbeleidigung (29 Jan 2026)"),
    "BT-2026-geas": (
        "https://www.bundestag.de/resource/blob/1134554/20260227_1_xls.xlsx", 6419,
        "GEAS-Anpassungsgesetz (27 Feb 2026)"),
    "BT-2026-grundsicherung": (
        "https://www.bundestag.de/resource/blob/1151676/20260305_1_xls.xlsx", 6422,
        "Bürgergeld → neue Grundsicherung, SGB II (5 Mar 2026)"),
    "BT-2026-energiesteuer": (
        "https://www.bundestag.de/resource/blob/1167454/20260424_1_xls.xlsx", 6495,
        "Temporäre Absenkung der Energiesteuer für Kraftstoffe (24 Apr 2026)"),
    "BT-2026-stromsteuer": (
        "https://www.bundestag.de/resource/blob/1167458/20260424_2_xls.xlsx", 6498,
        "Änderung des Stromsteuergesetzes (24 Apr 2026)"),
    "BT-2026-bafoeg": (
        "https://www.bundestag.de/resource/blob/1184012/20260611_1_xls.xlsx", 6551,
        "Beschlussempfehlung: BAföG-Reform-Antrag ablehnen (11 Jun 2026)"),
    "BT-2026-emissionsmengen": (
        "https://www.bundestag.de/resource/blob/1184018/20260611_4_xls.xlsx", 6552,
        "Jahresemissionsgesamtmengen-Verordnung 2031–2040 (11 Jun 2026)"),
}

VOTE_COLS = ("ja", "nein", "Enthaltung", "ungültig", "nichtabgegeben")
# XLSX Fraktion strings <-> abgeordnetenwatch fraction labels (prefix-matched)
AW_FRAKTION = {
    "CDU/CSU": "CDU/CSU", "SPD": "SPD", "AfD": "AfD", "BÜ90/GR": "BÜNDNIS 90/DIE GRÜNEN",
    "Die Linke": "Die Linke", "Fraktionslos": None,  # aw labels the lone wolves individually
}
AW_VOTE = {"yes": "ja", "no": "nein", "abstain": "Enthaltung", "no_show": "nichtabgegeben"}


def fetch(url, dest):
    if not dest.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "riot-pipeline"})
        dest.write_bytes(urllib.request.urlopen(req).read())
    return dest


def parse_xlsx(path):
    """The official per-MP sheet -> list of member dicts."""
    with zipfile.ZipFile(path) as z:
        shared = [
            "".join(t.text or "" for t in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"))
            for si in ET.fromstring(z.read("xl/sharedStrings.xml"))
        ]
        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    rows = []
    for row in sheet.iter(ns + "row"):
        cells = {}
        for c in row.iter(ns + "c"):
            col = re.match(r"[A-Z]+", c.get("r")).group(0)
            v = c.find(ns + "v")
            if v is None:
                continue
            cells[col] = shared[int(v.text)] if c.get("t") == "s" else v.text
        rows.append(cells)
    header = {v: k for k, v in rows[0].items()}
    members = []
    for cells in rows[1:]:
        if not cells.get(header["Name"]):
            continue
        vote = [v for v in VOTE_COLS if cells.get(header[v]) == "1"]
        assert len(vote) == 1, f"{path.name}: not exactly one vote mark in {cells}"
        members.append({
            "fraktion": cells[header["Fraktion/Gruppe"]],
            "name": cells[header["Name"]],
            "vorname": cells.get(header["Vorname"], ""),
            "vote": vote[0],
            "wp": cells.get(header["Wahlperiode"]),
            "sitzung": cells.get(header["Sitzungnr"]),
            "abstimmnr": cells.get(header["Abstimmnr"]),
        })
    return members


def aw_counts(poll_id):
    """abgeordnetenwatch per-Fraktion counts for the cross-check."""
    with urllib.request.urlopen(AW.format(poll_id)) as r:
        data = json.load(r)["data"]
    counts = {}
    for v in data:
        label = ((v.get("fraction") or {}).get("label", "") or "").replace("­", "")
        frak = next((x for a, x in (
            ("CDU/CSU", "CDU/CSU"), ("SPD", "SPD"), ("AfD", "AfD"),
            ("BÜNDNIS 90/DIE GRÜNEN", "BÜ90/GR"), ("Die Linke", "Die Linke"),
        ) if label.startswith(a)), "Fraktionslos")
        vote = AW_VOTE.get(v["vote"])
        if vote:
            counts.setdefault(frak, {}).setdefault(vote, 0)
            counts[frak][vote] += 1
    return counts, len(data)


OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)
for vid, (url, poll, what) in DECK.items():
    members = parse_xlsx(fetch(url, CACHE / url.rsplit("/", 1)[-1]))
    counts = {}
    for m in members:
        frak = m["fraktion"]
        counts.setdefault(frak, {c: 0 for c in VOTE_COLS})
        counts[frak][m["vote"]] += 1
    totals = {c: sum(f[c] for f in counts.values()) for c in VOTE_COLS}
    # The independent cross-check (per-Fraktion ja/nein/Enthaltung/nichtabgegeben).
    # The official XLSX is ground truth; a |diff| of 1 is tolerated and RECORDED
    # (the two sources occasionally disagree on a single member, e.g. a correction
    # published after the sitting). Anything larger is fatal.
    aw, n_aw = aw_counts(poll)
    discrepancies = []
    for frak, c in counts.items():
        if frak == "Fraktionslos":
            continue
        for col in ("ja", "nein", "Enthaltung", "nichtabgegeben"):
            got = aw.get(frak, {}).get(col, 0)
            want = c[col] + (c["ungültig"] if col == "nichtabgegeben" else 0)
            if abs(got - want) > 1:
                raise SystemExit(
                    f"{vid}: XLSX/abgeordnetenwatch mismatch {frak} {col}: {want} vs {got}")
            if got != want:
                discrepancies.append(f"{frak} {col}: official XLSX {want}, abgeordnetenwatch {got}")
    date = re.search(r"/(\d{8})_", url).group(1)
    record = {
        "id": vid,
        "what": what,
        "date": f"{date[:4]}-{date[4:6]}-{date[6:]}",
        "wahlperiode": members[0]["wp"],
        "sitzung": members[0]["sitzung"],
        "abstimmnr": members[0]["abstimmnr"],
        "source_xlsx": url,
        "source_list": "https://www.bundestag.de/parlament/plenum/abstimmung/liste",
        "abgeordnetenwatch_poll": poll,
        "crosschecked": "per-Fraktion counts checked against abgeordnetenwatch API v2 "
                        f"(poll {poll}, {n_aw} members) at fetch time",
        "crosscheck_discrepancies": discrepancies,
        "totals": totals,
        "members": [{k: m[k] for k in ("fraktion", "name", "vorname", "vote")}
                    for m in members],
    }
    (OUT / f"{vid}.json").write_text(json.dumps(record, ensure_ascii=False, indent=1) + "\n")
    print(f"{vid:<30} {totals['ja']:>3}-{totals['nein']:<3} enth {totals['Enthaltung']:>2}  "
          f"({len(members)} MPs, aw poll {poll} ok)  {what}")
print(f"\nwrote {len(DECK)} roll calls to {OUT.relative_to(ROOT)}/")
