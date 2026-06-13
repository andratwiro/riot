# The footer room — official card, informal crowd

Status: design agreed (Rob, 2026-06-13), prototype stage. Not yet wired into the
live app. This note is the source of truth for the idea; `riot_footer_room_prototype.html`
is the standalone feel-test that came before any change to `live.js`/`style.css`.

## The thesis

Split the screen by register, top to bottom:

- **Top is official.** The card is the ballot, then the chamber's verdict: the
  stamp and the party circles in their Against / Abstain / For columns. Clean.
  This is where the real democracy happened.
- **Bottom is informal.** The room's people, as emoji, living in a footer. While
  a ballot is open they are a loose, busy cluster, slightly colliding, present
  and waiting. After the card reveals they drift out into three loose piles
  under the same columns the card uses above. No titles, no numbers. People
  milling in a room.

Solo and the live room become the same app: same card, same buttons, same
navigation, same top progress. The live room just grows a footer of people.
Solo's footer is simply empty.

## Scope

- **Live multiplayer only** (and the `simlive` rig that stands in for it). The
  footer's directional piles need each person's vote, and only the live layer
  writes per-person cast markers. The async room carries activity and a map
  coordinate, never per-person direction, by doctrine. So:
  - **Async stays exactly as it is.** It keeps its current top strip, its
    anonymous per-card split, the opinion map. Untouched.
  - **Solo** shows card plus nav plus progress, no footer.
- Consequence worth naming: because async keeps its top strip, the "identical
  top chrome" win is really **solo and live**. Async stays the outlier wearing a
  top strip. Accepted: async is the quiet mode, not the demo.

## The footer, two states bound to the current card

The footer mirrors the card body. Its state follows each card's own reveal, not
a global room state.

1. **Card unvoted** → loose physics cluster, everyone milling, centered.
2. **Card voted / revealed** → the same emoji fan out to the sides into three
   column-piles (Against left, For right, Abstain stays center), aligned under
   the card's columns, then keep absorbing emoji live as the rest of the room
   casts on this card. The piles **hold** for as long as you sit on the revealed
   card, so you can read the room against the chamber's verdict above.
3. **Advance to the next, still-unvoted card** → the piles regroup to center,
   back to the loose cluster.

So the animation is fan-out, hold, regroup-on-advance. Not a momentary flourish.

## Settled calls

- **No counts under the piles.** The pile size is the quantity; the exact
  figures already live on the card up top. This supersedes the live piles' "+N"
  count for the footer.
- **Show every body, packed and shrinking.** Busy is the point. This knowingly
  supersedes the recent "3 overlapping discs plus count" summary (commit
  fd911a8) for the footer specifically. The chamber row inside the card keeps
  its own treatment.
- **Reveal forms on your vote, fills live.** Piles appear the instant your
  ballot lands and keep absorbing faces as others vote, not on a threshold.
- **Real physics.** A light force sim: attraction to a target, repulsion between
  neighbours, gentle jitter, damping. Transforms and opacity only, so the 60fps
  presence floor holds. Roughly 40 bodies at the sim cap.
- **Size by count.** Big when few, tighter as the room fills. Reuse the lobby's
  step function (`lobbyPresence`: 64 / 54 / 44 / 36 / 30 px).
- **Your emoji** keeps its purple ring and stays identifiable everywhere. The
  wave still bops it: in the cluster and in the pile, a wave is an upward
  impulse on your body.

## What this touches when we wire it in (later)

- `renderLivePiles` splits in two: the **chamber row** (party circles, stamp,
  labels) stays in the card body; the **room** moves to the footer component and
  becomes the physics cluster / piles. Top and bottom never mix.
- The live layer renders the footer instead of (or below) the top room strip.
  The top strip's faces / pulse / "N here" / room-progress chrome go away for
  live; the top becomes identical to solo.
- Per-card state already exists: `lvS.cast[id]` gives the per-person directions
  the piles read; `answers[id]` is your own. The cluster (pre-vote) draws from
  presence (`PEERS` filtered by `mpVisiblePids`), exactly as the lobby does.
- The final opinion map (`#resultMap`, the done screen) is unchanged. The footer
  is a voting-flow element; the map is still the finale.

## Open / deferred

- Exact footer height and how it shares vertical space with the card on small
  phones (the card must never resize when the stamp lands; the footer must not
  push it).
- Whether the moderator stage mirrors the footer or keeps the enlarged piles.
- Reduced-motion fallback: place bodies at their targets statically, no sim.
