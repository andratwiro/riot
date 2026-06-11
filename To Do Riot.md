# RIOT — build to-do (riot.reus)

Phased build for Claude Code; each phase ends in something visible. The *why*, principles, data model, and architecture live in the context doc (the other file) — read that first. Implementation is your call; iterate with Rob.

## 0 · Data — where do Reus' votes live? (the gate)
- [ ] Find where Reus council votes are published (actes del ple, etc.) and in what form. Check: recorded per party group or per councillor? structured, or buried in PDF prose? This gates everything downstream.
- [ ] Pull into the data table: per decision, each party's vote ∈ {for, against, abstain}.
- [ ] Where useful, reuse Opposition Copilot's politically-blind transcriptions as raw source.
- [ ] **Milestone:** a list view of decisions with the party-vote breakdown.

## 1 · Context per decision (the compression layer)
- [ ] Attach a short, citizen-legible explanation per decision + a `source_url`. Honest and sourced — this same context feeds both Rob's and the AI's votes.
- [ ] Info icon per card → expand the explanation / open the source.
- [ ] **Milestone:** decisions list with an explanation + source link on each.

## 2 · Mark what counts (contested-filter — core)
- [ ] Set `counts` per decision: true = politically-charged / divisive; false = unanimous / ceremonial / pure tràmit. Keep a running list of the excluded ones to auto-flag similar later.
- [ ] All downstream steps (voting, affinity, map) use `counts=true` only.

## 3 · Voting UI (Polis-style)
- [ ] Card / stack interface; Rob votes for / against / abstain on each `counts=true` decision. Store his votes in `localStorage` (private, device-local, never committed).
- [ ] A counter of decisions still to rank.

## 4 · The GHOST (the AI proxy, rebranded 2026-06)
- [ ] `soul.md` (gitignored, private) holds Rob's general political profile.
- [ ] A script Rob triggers manually: read `soul.md` + each decision's context → AI votes for / against / abstain, blind to Rob's votes → write into the table. The AI is an extra "party".

## 5 · Comparison
- [ ] Affinity % over `counts=true` decisions: Rob vs each party, and Rob vs his GHOST.
- [ ] Position the parties (no clustering — too few).

## 6 · Map + proof
- [ ] Polis-style 2D map (PCA on decisions × voters): plot the parties (logos), Rob, and the GHOST.
- [ ] Report the AI's out-of-sample hit-rate vs Rob's votes — the actual proof, reported separately from the affinity %.

## 7 · Ship
- [ ] Deploy to GitHub Pages from the public repo → live URL (this instance = riot.reus).