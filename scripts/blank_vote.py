#!/usr/bin/env python3
"""
blank_vote.py — the BLANK: the no-soul control for the GHOST experiment.

Same machine as ai_vote.py with soul.md REMOVED: the model reads each decision's
*neutral, citizen-visible* context and votes its own judgment. The BLANK exists
for exactly one comparison: GHOST-vs-Rob agreement minus BLANK-vs-Rob agreement
is how much soul.md actually moves the proxy away from the model's prior
(the Habermolt ρ=+0.15 question, answered with ground truth).

The firewall is identical to the ghost's:
  - never sees Rob's votes, the party votes, the outcome, the tally, or deep_lectura.
  - additionally never sees soul.md — that's the whole point.
The mechanical instructions deliberately MIRROR ai_vote.py's (decisive, abstain
rarely, one-sentence rationale, same output shape) so the only varying factor
between GHOST and BLANK is the worldview. Don't "improve" one prompt without
the other.

The committed 114 votes (data/blank_votes.json) were produced 2026-06-12 via
Claude Code subagents on claude-fable-5 (no API key in env), same as the ghost
runs. This script is the documented re-run path from an env with a key.

Usage:
    python scripts/blank_vote.py                 # vote on every ghost-voted decision
    python scripts/blank_vote.py --only-missing
    python scripts/blank_vote.py --ids PLE_04_2026_ORD-p9 ...
    python scripts/blank_vote.py --limit 3
    python scripts/blank_vote.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DECISIONS = ROOT / "data" / "decisions.json"
AI_VOTES = ROOT / "data" / "ai_votes.json"   # the blank votes the GHOST's id set, nothing more
OUT = ROOT / "data" / "blank_votes.json"
OUT_JS = ROOT / "cities" / "reus" / "blank_votes.js"

MODEL = "claude-fable-5"

# Same allowed fields as ai_vote.py — keep the two lists in sync by hand.
CONTEXT_FIELDS = [
    "id",
    "type",
    "legal_category",
    "proposed_by",
    "title",
    "topic",
    "stake",
    "headline",
    "human_body",
    "source_brief",
    "deep_facts",
]

# Mirrors ai_vote.py's SYSTEM_INSTRUCTIONS with every soul reference removed and
# nothing else changed in spirit: same decisiveness, same rationale contract.
SYSTEM_INSTRUCTIONS = """\
You are an AI asked to vote on municipal council decisions. No worldview or
profile is provided — this is deliberate. For each decision you are given, you
decide how YOU would vote, applying your own judgment cold to the decision's own
sourced context.

Rules:
- Decide `for`, `against`, or `abstain`. Judge content over proposer; you must not
  guess or lean based on which party tabled it. Declarative/symbolic motions still
  count. Be decisive (abstain rarely — reserve it for genuinely two-sided cases you
  cannot resolve).
- Read ONLY the decision context provided. You do not know how anyone actually voted.
- `confidence` is 0.0–1.0: how clearly your judgment points to this vote.
- `rationale` is ONE sentence (Catalan or English) naming the consideration that decided it.
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
        "Here is the decision the council is voting on. Decide how you would vote.\n\n```json\n"
        + json.dumps(ctx, ensure_ascii=False, indent=2)
        + "\n```"
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only-missing", action="store_true")
    ap.add_argument("--ids", nargs="*")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    data = json.loads(DECISIONS.read_text())
    decisions = data["decisions"]

    # comparability: the blank votes exactly the GHOST's id set
    if AI_VOTES.exists():
        ghost_ids = set(json.loads(AI_VOTES.read_text()).get("votes", {}))
        decisions = [d for d in decisions if d["id"] in ghost_ids]

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
        print("=== SYSTEM (instructions only — NO soul) ===\n")
        print(SYSTEM_INSTRUCTIONS)
        print("\n=== USER (decision context — note: no votes/outcome/lectura) ===\n")
        print(build_user_message(d))
        return 0

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
            system=[{"type": "text", "text": SYSTEM_INSTRUCTIONS, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": build_user_message(d)}],
            output_format=Vote,
        )
        v = resp.parsed_output
        votes[did] = {"vote": v.vote, "confidence": round(v.confidence, 2), "rationale": v.rationale}
        print(f"[{i}/{len(decisions)}] {did:28s} -> {v.vote:7s} ({v.confidence:.2f})")

    out = {
        "model": MODEL,
        "n_votes": len(votes),
        "note": "BLANK votes — the no-soul control. Same neutral inputs and mechanics as the GHOST, minus the worldview: what the bare model would vote.",
        "votes": votes,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    OUT_JS.write_text("window.BLANK_VOTES = " + json.dumps(out, ensure_ascii=False) + ";\n")
    print(f"\nWrote {len(votes)} votes to {OUT.relative_to(ROOT)} + {OUT_JS.relative_to(ROOT)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
