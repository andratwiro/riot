#!/usr/bin/env python3
"""
ai_vote.py — the RIOT GHOST (Phase 4; display name GHOST — the AI that predicts its keeper's votes).

Reads soul.md (Rob's private, general political profile) + each decision's
*neutral, citizen-visible* context, and produces a blind vote (for/against/abstain)
per decision via the Claude API. Writes the votes to data/ai_votes.json.

NON-NEGOTIABLES (the whole proof depends on these):
  - The AI never sees Rob's votes (those live only in browser localStorage anyway).
  - The AI never sees the recorded party votes, the outcome, or the tally — no answer leakage.
  - The AI never sees `deep_lectura` (the analyst's human-facing read — explicitly *not* AI input).
  - soul.md is a GENERAL worldview, never tuned against these decisions. Do not "fix" a wrong
    AI vote by editing soul.md to match Rob — that destroys the out-of-sample proof.

soul.md is gitignored. The AI's *outputs* (data/ai_votes.json) ARE committed.

Usage:
    pip install anthropic            # one-time
    export ANTHROPIC_API_KEY=...     # or use an `ant auth login` profile
    python scripts/ai_vote.py                 # vote on every decision (re-votes all)
    python scripts/ai_vote.py --only-missing  # only decisions not already in ai_votes.json
    python scripts/ai_vote.py --ids PLE_04_2026_ORD-p9 ...   # specific decisions
    python scripts/ai_vote.py --limit 3       # first N (cheap smoke test)
    python scripts/ai_vote.py --dry-run       # print the exact prompt for one card, no API call
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOUL = ROOT / "soul.md"
DECISIONS = ROOT / "data" / "decisions.json"
OUT = ROOT / "data" / "ai_votes.json"
# ai_votes.js sits in the Reus city bundle (cities/reus/) so the viewer reads it as
# window.AI_VOTES, matching data.js — no fetch(), works locally and on GitHub Pages.
OUT_JS = ROOT / "cities" / "reus" / "ai_votes.js"

MODEL = "claude-opus-4-8"

# The ONLY decision fields the ghost is allowed to read. Anything that reveals
# how Rob, the parties, or the council actually voted is deliberately excluded.
CONTEXT_FIELDS = [
    "id",
    "type",
    "legal_category",
    "proposed_by",      # who tabled it — a real citizen sees this; soul says judge content over proposer
    "title",
    "topic",
    "stake",
    "headline",
    "human_body",
    "source_brief",
    "deep_facts",       # neutral, cited — the ONLY "deep" layer the ghost reads
]

# NOTE (GHOST rebrand, 2026-06): the prompt below still says "proxy" ON PURPOSE.
# It is part of the vote computation — rewording it changes the votes and breaks
# comparability with the committed 70-vote run. Brand lives in the UI, not here.
SYSTEM_INSTRUCTIONS = """\
You are an AI political proxy. Above is `soul.md` — a citizen's GENERAL political
worldview. It is the only lens you have. For each council decision you are given, you
decide how this citizen would vote, applying the worldview cold to the decision's own
sourced context.

Rules:
- Decide `for`, `against`, or `abstain`. Follow the soul's heuristics — especially:
  "who does it help?" is the master tiebreaker; judge content over proposer; merits over
  incumbency; declarative/symbolic motions still count; spend for right causes; be decisive
  (abstain rarely — reserve it for genuinely two-sided cases the soul can't resolve).
- Read ONLY the worldview and the decision context provided. You do not know how anyone
  actually voted, and you must not guess based on which party tabled it.
- `confidence` is 0.0–1.0: how clearly the worldview points to this vote.
- `rationale` is ONE sentence (Catalan or English) naming the worldview principle that decided it.
Output strictly via the structured format requested."""


def load_votes() -> dict:
    if OUT.exists():
        try:
            return json.loads(OUT.read_text())
        except Exception:
            return {}
    return {}


def decision_context(d: dict) -> dict:
    return {k: d[k] for k in CONTEXT_FIELDS if d.get(k) not in (None, "", [], {})}


def build_user_message(d: dict) -> str:
    ctx = decision_context(d)
    return (
        "Here is the decision the council is voting on. Apply the worldview and decide "
        "how this citizen would vote.\n\n```json\n"
        + json.dumps(ctx, ensure_ascii=False, indent=2)
        + "\n```"
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only-missing", action="store_true", help="skip decisions already voted")
    ap.add_argument("--ids", nargs="*", help="only these decision ids")
    ap.add_argument("--limit", type=int, help="only the first N decisions")
    ap.add_argument("--dry-run", action="store_true", help="print one prompt and exit, no API call")
    args = ap.parse_args()

    if not SOUL.exists():
        print(f"ERROR: {SOUL} not found. soul.md is the ghost's only input.", file=sys.stderr)
        return 1

    soul_text = SOUL.read_text()
    soul_hash = hashlib.sha256(soul_text.encode()).hexdigest()[:12]
    system_blocks = soul_text + "\n\n---\n\n" + SYSTEM_INSTRUCTIONS

    data = json.loads(DECISIONS.read_text())
    decisions = data["decisions"]

    if args.ids:
        wanted = set(args.ids)
        decisions = [d for d in decisions if d["id"] in wanted]

    store = load_votes()
    prior = store.get("votes", {}) if isinstance(store, dict) else {}

    if args.only_missing:
        decisions = [d for d in decisions if d["id"] not in prior]

    if args.limit:
        decisions = decisions[: args.limit]

    if not decisions:
        print("Nothing to vote on (all done?). Use --ids or drop --only-missing to re-vote.")
        return 0

    if args.dry_run:
        d = decisions[0]
        print("=== SYSTEM (soul.md + instructions) ===\n")
        print(system_blocks)
        print("\n=== USER (decision context — note: no votes/outcome/lectura) ===\n")
        print(build_user_message(d))
        return 0

    # Import here so --dry-run works without the SDK installed.
    try:
        import anthropic
    except ImportError:
        print("ERROR: pip install anthropic", file=sys.stderr)
        return 1
    from pydantic import BaseModel
    from typing import Literal

    class Vote(BaseModel):
        vote: Literal["for", "against", "abstain"]
        confidence: float
        rationale: str

    client = anthropic.Anthropic()

    votes = dict(prior)
    for i, d in enumerate(decisions, 1):
        did = d["id"]
        resp = client.messages.parse(
            model=MODEL,
            max_tokens=4000,
            thinking={"type": "adaptive"},
            output_config={"effort": "medium"},
            system=[{"type": "text", "text": system_blocks, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": build_user_message(d)}],
            output_format=Vote,
        )
        v = resp.parsed_output
        votes[did] = {"vote": v.vote, "confidence": round(v.confidence, 2), "rationale": v.rationale}
        cr = resp.usage.cache_read_input_tokens or 0
        print(f"[{i}/{len(decisions)}] {did:28s} -> {v.vote:7s} ({v.confidence:.2f})  cache_read={cr}")

    out = {
        "model": MODEL,
        "soul_hash": soul_hash,
        "n_votes": len(votes),
        "note": "GHOST votes — blind from soul.md + each decision's neutral context. soul.md is private; only these outputs are committed.",
        "votes": votes,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    OUT_JS.write_text("window.AI_VOTES = " + json.dumps(out, ensure_ascii=False) + ";\n")
    print(f"\nWrote {len(votes)} votes to {OUT.relative_to(ROOT)} + {OUT_JS.relative_to(ROOT)} (soul {soul_hash}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
