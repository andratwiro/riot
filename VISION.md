# RIOT — Vision

> **Can an AI proxy faithfully represent a citizen's political will on real
> decisions — and can we *prove* it?** This doc is the durable *why* behind RIOT:
> the problem it attacks, the two-engine machine it's becoming, and where it goes.
> For the non-negotiable design principles see [`Riot.md`](Riot.md); for the
> pitch aimed at GoVocal see [`docs/GOVOCAL_PITCH.md`](docs/GOVOCAL_PITCH.md).

## The problem: disaffection is a *bandwidth* problem, not apathy
Dozens of governing bodies rule our lives — the neighbourhood association, the city
council, the region, the national parliament, the European Parliament. A human can
only really show up for one or two. People who go deep locally lose the thread on
the EU, even though it's the layer they can least afford to ignore and least able
to influence.

That gap — between *"this affects me"* and *"I can actually participate"* — is where
disaffection grows. And disaffection is the vacuum **authoritarianism** fills: when
people are locked out, a strongman becomes the "efficient" way to move decisions.
RIOT is a bet that the gap can be closed, on two fronts at once.

## Two restorations → two engines

### Engine 1 — Deliberation (the conversation)
As a plenary happens, each topic should spin up a **deliberation space**: not a
binary pass/no-pass, but the real thing — amendments, trade-offs, compromises, and
**shared facts** so everyone argues from the same baseline. Binary voting collapses
complexity; it's an artefact of how analog democracy had to work, not how it should.
A regional budget is the perfect villain: nobody can hold it in their head, yet the
process pretends they can. A better *medium* for these conversations — where you can
preview what's going on and everyone arrives with a similar understanding — is the
thing GoVocal is already best in the world at. RIOT just points it at the **real
agenda** (what the council actually decides), in real time. This is where RIOT meets
Cort's "Deliberative Spaces."

### Engine 2 — Representation (the proxy / "ghost")
Deliberation costs time people don't have — which is exactly why we *pay*
politicians to do it full-time. So each citizen gets a proxy (working name: the
**ghost**) that shows up for them. It is built from the citizen's own positions (via
a short psychographic profile) and — non-negotiably — it is **explainable and
checkable**: it tells you *why* it voted each way, so you can audit it and correct
it. Falsifiability, not faith.

### The synthesis: the proxy is what lets deliberation *scale*
The two engines aren't two features — they're one machine. The proxy is the
**attention-routing layer**:

> **Go deep where you care; stay represented everywhere else.**

On the handful of topics you care about, you **tag in and replace your ghost** to
join the live deliberation — which also concentrates the people who *actually care*
into each conversation. On everything else, your ghost covers the long tail, so you
are never simply *absent* — you're represented by something you can inspect, instead
of only by a politician you didn't choose for this. And what flows back to
politicians isn't a crude yes/no tally — it's a **deliberated, explained, pre-vote
signal**: where citizens land, what they'd amend, and why.

## Why falsifiability is the whole game
Anyone can build an AI that claims to speak for you. RIOT's only defensible claim is
that **you can check it**. So the proxy votes *blind* (never from your own votes),
its profile is general (never tuned to the answer key), and the metric that matters
is the **out-of-sample hit-rate** — how often it calls your *unseen* votes right.
"The AI is your closest party" is near-guaranteed and proves nothing; predicting
votes it has never seen is the proof. (See the non-negotiables in `Riot.md`.)

## Lineage, and the wedge
RIOT comes out of work at **GoVocal** (formerly Citizen Lab; peer to Decidim) on
participation platforms. The frustration that started it: those platforms are made
to run participation on the *sanitized* agenda — the safest decisions councils let a
(politically powerless) participation department touch. RIOT's wedge is to run
participation on the **real agenda**, and to do it as a **finding, not a request**:
*"here's how citizens' proxies would have voted vs. how the council actually voted
vs. each party."* It needs no council's permission, runs on public records, and once
it exists it creates the pressure a polite consultation never could.

**The empirical seed:** over ~100 real Reus council proposals, Rob's proxy —
profiled from his positions, voting blind — tracks his will, and stacks up against
the parties. That's the N=1 evidence the rest of the vision is built on.

## What's built today (v0.40) — the playable proof
- A live, **multi-city** viewer (`?city=` + a header selector): **Reus** city
  council and the **Brussels-Capital Parliament** (2025-26 roll-call votes parsed
  from the plenary CRIs, ~39 contested cards, 13 political groups), each decision
  digested into the legible three layers and traceable to source.
- **Multiplayer** (Firebase Realtime DB): each city is a shared room — invite
  people, they react, and everyone **sees each other on the opinion map** alongside
  the parties and the AI proxy.
- This is the "political compass over real votes" — honest, recognisable, and
  deliberately the *shallow end*: it's Engine 2, lite.

## Where it's going (the two missing halves)
1. **Real-time deliberation (Engine 1).** The full vision is a *live* plenary
   streamed into the app, each topic triggering its deliberation space. The cheap,
   honest way to *show* it: a **replay** — scrub one real plenary on a timer, and as
   each topic comes up, open its space. A "version two" that demonstrates the feeling
   without the hard live infrastructure.
2. **The explainable, per-citizen proxy (Engine 2, in full).** In-app psychographic
   onboarding → your own ghost → it explains its votes so you can audit it → the
   **tag-in** mechanic that hands a topic back to you when you care.

Put the two together and the question becomes the mission:

> **Can we build digital spaces that make governance legible and deliberation good —
> and give people a voice they can verify, even when they don't have the time to use
> it themselves?**
