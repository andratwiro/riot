#!/usr/bin/env python3
"""Fetch the Europe deck's roll calls and source texts into data/europe/.

Commons/Bundestag posture on the official record, one step removed: the
per-MEP votes come from HowTheyVote.eu (a public, open-data mirror of the
European Parliament's roll-call XML, every MEP with country and group), and
the texts come from the Parliament itself.

For every card in VOTES:
- data/europe/rollcalls/<card id>.json: the vote's metadata, the official
  totals and one row per MEP {name, country, group, party, vote}. The per-
  country counts rebuilt from the rows are cross-checked against HowTheyVote's
  own by-country stats and the rows against the official totals; any
  mismatch is fatal.
- data/europe/texts/<card id>.txt: the text the Parliament voted on (the
  report or resolution, europarl.europa.eu/doceo) plus the Legislative
  Observatory summary (oeil.europarl.europa.eu). The bureaucratic source the
  card copy is checked against. europarl.europa.eu answers scripted clients
  with a 202 bot wall, so pages are rendered with the headless Chromium in
  ~/.cache/ms-playwright (the same one the screenshot skill uses).

The 2019 copyright vote predates HowTheyVote (July 2019 on). Its rollcall was
assembled once from the Parliament's own RCV XML (26 March 2019, item 23,
A8-0245/2018, 348/274/36), each MEP matched to their country via Parltrack;
it is committed as-is and this script only re-checks its sums.

Run from the repo root (network):

    python3 scripts/fetch_votes_eu.py            # all
    python3 scripts/fetch_votes_eu.py --no-text  # roll calls only
"""
import glob, html, json, os, pathlib, re, subprocess, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
RC = ROOT / "data" / "europe" / "rollcalls"
TX = ROOT / "data" / "europe" / "texts"
API = "https://howtheyvote.eu/api/votes/{}"

# card id -> HowTheyVote vote id (None = committed rollcall, see docstring)
VOTES = {
    "EP-2019-copyright-upload-filters": None,
    "EP-2022-taxonomy-gas-nuclear": 146888,
    "EP-2023-cars-2035": 152544,
    "EP-2024-nature-restoration": 164499,
    "EP-2024-ai-act": 166051,
    "EP-2024-migration-pact-solidarity": 167531,
    "EP-2025-rearm-europe": 172867,
    "EP-2025-wolf-protection": 176241,
    "EP-2025-censure-von-der-leyen": 178149,
    "EP-2026-mercosur-court": 183884,
}
# texts for the vote HowTheyVote doesn't carry
EXTRA_TEXTS = {
    "EP-2019-copyright-upload-filters": [
        ("Adopted text", "https://www.europarl.europa.eu/doceo/document/TA-8-2019-0231_EN.html"),
    ],
}
POS = {"FOR": "for", "AGAINST": "against", "ABSTENTION": "abstain", "DID_NOT_VOTE": None}
ISO = {"GR": "GR", "UK": "GB"}   # HowTheyVote alpha-2 is already ISO; keep one place to remap


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "riot-fetch (github.com/andratwiro/riot)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def chromium():
    c = sorted(glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome")))
    c += sorted(glob.glob(os.path.expanduser("~/Library/Caches/ms-playwright/chromium-*/chrome-mac*/*.app/Contents/MacOS/*")))
    return c[-1] if c else None


def page_text(url):
    """Rendered page -> plain text (scripts/styles/nav stripped)."""
    ch = chromium()
    if ch:
        dom = subprocess.run([ch, "--headless=new", "--no-sandbox", "--disable-gpu",
                              "--virtual-time-budget=8000", "--dump-dom", url],
                             capture_output=True, text=True, timeout=90).stdout
    else:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        dom = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
    dom = re.sub(r"(?is)<(script|style|noscript|header|footer|nav)\b.*?</\1>", " ", dom)
    dom = re.sub(r"(?i)<br\s*/?>|</(p|div|li|tr|h\d)>", "\n", dom)
    t = html.unescape(re.sub(r"<[^>]+>", " ", dom))
    t = "\n".join(re.sub(r"[ \t ]+", " ", l).strip() for l in t.splitlines())
    return re.sub(r"\n{3,}", "\n\n", t).strip()


def fetch_rollcall(cid, vid):
    d = get_json(API.format(vid))
    members = []
    for mv in d["member_votes"]:
        m, v = mv["member"], POS[mv["position"]]
        if v is None:
            continue
        members.append({"name": m["full_name"], "country": ISO.get(m["country"]["iso_alpha_2"], m["country"]["iso_alpha_2"]),
                        "group": (m.get("group") or {}).get("code"),
                        "party": (m.get("national_party") or {}).get("short_label"), "vote": v})
    tot = d["stats"]["total"]
    totals = {"for": tot["FOR"], "against": tot["AGAINST"], "abstain": tot["ABSTENTION"]}
    # cross-check 1: rows vs official totals
    got = {k: sum(1 for m in members if m["vote"] == k) for k in totals}
    assert got == totals, f"{cid}: rows {got} != totals {totals}"
    # cross-check 2: per-country rows vs HowTheyVote's own by-country stats
    for row in d["stats"]["by_country"]:
        cc = ISO.get(row["country"]["iso_alpha_2"], row["country"]["iso_alpha_2"])
        want = {"for": row["stats"]["FOR"], "against": row["stats"]["AGAINST"], "abstain": row["stats"]["ABSTENTION"]}
        have = {k: sum(1 for m in members if m["country"] == cc and m["vote"] == k) for k in want}
        assert have == want, f"{cid} {cc}: rows {have} != by_country {want}"
    rec = {
        "id": cid, "htv_id": vid, "htv_url": f"https://howtheyvote.eu/votes/{vid}",
        "date": d["timestamp"][:10], "title": d["display_title"], "vote_on": d.get("description"),
        "reference": d.get("reference"), "result": d.get("result"),
        "document": d.get("document"), "procedure": d.get("procedure"),
        "sources": [s["url"] for s in d.get("sources", [])],
        "links": [{"title": l["title"], "url": l["url"]} for l in d.get("links", [])],
        "crosschecked": "per-MEP rows re-summed against the official totals and HowTheyVote's by-country stats at fetch time",
        "totals": totals, "members": sorted(members, key=lambda m: (m["country"], m["name"])),
    }
    (RC / f"{cid}.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1))
    return rec


def check_committed(cid):
    rec = json.loads((RC / f"{cid}.json").read_text())
    got = {k: sum(1 for m in rec["members"] if m["vote"] == k) for k in rec["totals"]}
    assert got == rec["totals"], f"{cid}: committed rows {got} != totals {rec['totals']}"
    return rec


def fetch_texts(cid, rec):
    parts = []
    doc = (rec or {}).get("document") or {}
    targets = []
    if doc.get("url"):
        targets.append(("Text voted on", doc["url"]))
    for l in (rec or {}).get("links", []):
        if l["title"] in ("Summary", "Press release"):
            targets.append((l["title"], l["url"]))
    targets += EXTRA_TEXTS.get(cid, [])
    for label, url in targets:
        try:
            t = page_text(url)
        except Exception as e:  # a missing summary shouldn't sink the run
            print(f"  ! {cid}: {label} failed ({e})", file=sys.stderr)
            continue
        parts.append(f"===== {label} · {url}\n\n{t}\n")
    (TX / f"{cid}.txt").write_text("\n".join(parts))
    return len(parts)


def main():
    RC.mkdir(parents=True, exist_ok=True)
    TX.mkdir(parents=True, exist_ok=True)
    texts = "--no-text" not in sys.argv
    for cid, vid in VOTES.items():
        rec = fetch_rollcall(cid, vid) if vid else check_committed(cid)
        n = fetch_texts(cid, rec) if texts else 0
        print(f"{cid}: {sum(rec['totals'].values())} MEPs voting, totals {rec['totals']}" + (f", {n} text(s)" if texts else ""))


if __name__ == "__main__":
    main()
