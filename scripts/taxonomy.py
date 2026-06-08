#!/usr/bin/env python3
"""
RIOT — canonical legal-category taxonomy for plenary (Ple) agenda items.

This is the SINGLE SOURCE OF TRUTH for what kind of thing a Ple item legally is,
and therefore whether it is a *votable decision* that can become a card.

WHY this matters (Rob's call, critical): a fair card list must be made of things
that actually get VOTED and are real decisions — not a mixture of votes, oversight
instruments, and procedural housekeeping. The votability gate is the legal category,
and it sits BEFORE the contested-vs-unanimous signal (`kind` in the survey).

Both the regex corpus survey (extract_votes.py) and the per-session LLM extraction
must tag every item with `legal_category` + `votable` using THIS taxonomy, so that
nothing downstream has to re-derive it. See docs/FINDINGS.md for the prose rule.

Categories observed / expected in Reus actes (current mandate):

  VOTABLE  -> card-worthy
    proposta                 dictamen / proposta d'acord from a comissió informativa;
                             the binding governing decisions ("previ dictamen de la
                             Comissió Informativa de ...").
    mocio                    moció (de l'Alcaldia or d'un grup municipal); voted,
                             usually a non-binding political position. Sometimes voted
                             point-by-point ("Sotmesos els punts 1 a 4 de la moció...").
    proposicio               proposició; voted like a proposta (rarer).
    declaracio_institucional declaració institucional; usually adopted by assent.

  NOT VOTABLE -> never a card (oversight / information / housekeeping)
    dacio_compte             "donar compte" / dació de compte; the Ple only NOTES it
                             ("es donen per assabentats") — there is no vote.
    prec_pregunta            precs i preguntes; requests and questions to the govern.
    interpelacio             interpel·lació; debate, not voted.
    aprovacio_acta           aprovació de l'acta/esborrany de la sessió anterior.
    altre                    unclassified — flag for human review, do NOT silently card.
"""
import re

# category -> (votable, human label)
LEGAL_CATEGORIES = {
    "proposta":                 (True,  "Proposta / dictamen"),
    "mocio":                    (True,  "Moció"),
    "proposicio":               (True,  "Proposició"),
    "declaracio_institucional": (True,  "Declaració institucional"),
    "dacio_compte":             (False, "Dació de compte"),
    "prec_pregunta":            (False, "Precs i preguntes"),
    "interpelacio":             (False, "Interpel·lació"),
    "aprovacio_acta":           (False, "Aprovació de l'acta anterior"),
    "altre":                    (False, "Altre (revisar)"),
}

# Only these earn a card. Single source of truth for the inclusion gate.
VOTABLE_CATEGORIES = {c for c, (v, _) in LEGAL_CATEGORIES.items() if v}


def is_votable(category: str) -> bool:
    return category in VOTABLE_CATEGORIES


def classify_legal_category(text: str) -> str:
    """Classify an agenda item / vote lead-in into a legal category.

    Pass the item TITLE or the vote lead-in (the "Sotmes... a votació" phrase).
    Order matters: more specific / non-votable markers are tested first so a stray
    word later in the string can't upgrade a non-vote into a votable category.
    For the survey, pass ONLY the lead-in up to "votació" — the full snippet bleeds
    into the next item's title (e.g. a trailing "Donar compte del decret...").
    """
    t = (text or "").lower().replace("’", "'")
    if "interpel" in t:
        return "interpelacio"
    if "donar compte" in t or "dació de compte" in t or "dacio de compte" in t:
        return "dacio_compte"
    if re.search(r"aprovaci[oó].{0,30}(de l'acta|de l'esborrany|acta de la sessi)", t):
        return "aprovacio_acta"
    if "precs i preguntes" in t or re.search(r"\bprecs?\b", t) or re.search(r"\bpreguntes?\b", t):
        return "prec_pregunta"
    if "declaració institucional" in t or "declaracio institucional" in t:
        return "declaracio_institucional"
    if "moció" in t or "mocio" in t:        # incl. "...punts de la moció..."
        return "mocio"
    if "proposició" in t or "proposicio" in t:
        return "proposicio"
    if "proposta" in t or "proposa" in t or "dictamen" in t:
        return "proposta"
    return "altre"
