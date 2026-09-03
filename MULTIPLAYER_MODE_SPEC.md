# Gridiron Lab — Multiplayer Mode: full design map

Status: **Private + Parallel Universe Mode (sections 4A/12) is built and shipped** — Phase 0 and
Phase 1 of the roadmap in section 10 are done; see PROGRESS.md's own dated entry for what actually
shipped, what was found/fixed during the build, and what's still open. Sections 4B/13 (Same League
Mode) and 8 (Track B / public matchmaking) remain theoretical planning only, per the original
request — no implementation has started on either. This doc still follows the same planning-doc
convention as `MASTER_REMEDIATION_SPEC.md`: every "recommended" call for the unbuilt sections is a
default to accept or override, not a decision already made.

## 1. What the user asked for, restated precisely

Two players (call them **A** and **B**) each go through the Combine/draft using **the exact same
sequence of random rolls**, each independently choosing "best player available" without seeing the
other's picks (**blind**). Once both builds exist, the two careers are then either:

- **(a)** simulated as opponents inside **one shared league**, or
- **(b)** simulated as **two fully independent** careers that just happened to start from the same
  seed,

and a winner is declared from a composite of **accolades, rings, stats, money, etc.**

Per the user's follow-up, this needs to be designed for **two distinct delivery tracks**, not one:

- **Track A — Private Match**: two people who know each other, no account system, no server.
- **Track B — Public Match**: real, live online multiplayer — matchmaking, two strangers, synced
  in real time.

Both tracks share almost everything described in sections 2-6 below; they only diverge at
**how the shared seed and the blind separation are physically delivered** (section 7), and even
there, Track B's architecture is a superset of Track A's, not a different design.

## 2. The one hard technical prerequisite: an injectable, shared-seed PRNG

Right now, this codebase's entire simulation — Combine prospect rolls, respins, draft order,
every season's stat generation, injuries, playoffs, everything — calls the browser's global
`Math.random()` directly, unseeded, in what's certainly hundreds of call sites across `src/main.js`
and `src/sim/*.js`. There is **no existing production seeding mechanism** — the only seeded RNG in
this codebase today is `tests/helpers/seededRandom.mjs`'s `installSeededRandom(page, seed)`, which
overrides `window.Math.random` with a deterministic generator **for tests only**, injected into a
disposable page context, never shipped.

"The exact same rolls in order" for two real players is not a stat-formula problem, it's this
one architectural gap. Two real options:

- **Full refactor** (expensive, high-risk): thread a PRNG instance as an explicit parameter through
  every function that currently calls `Math.random()`, so combine/career logic never touches the
  global at all. Correct in the abstract, but touches an enormous fraction of `src/main.js` and
  `src/sim/*.js` — a multi-week, very-high-regression-risk undertaking on its own, unrelated to
  anything about multiplayer itself.
- **Global override at session start** (recommended): reuse the exact mechanism the test suite
  already validates dozens of times over — replace `window.Math.random` itself with a seeded
  generator (e.g. a small mulberry32/xorshift32 implementation, ~10 lines) the moment a multiplayer
  match starts, and restore/ignore it for ordinary solo play. **Zero call sites change.** Promote
  the test-only generator into a real module, e.g. `src/sim/prng.js`, exporting
  `createSeededRandom(seed)` and `installSeededRandom(seedString)` (installs onto
  `window.Math.random`), with `tests/helpers/seededRandom.mjs` becoming a thin wrapper around the
  same production module instead of its own parallel implementation (a nice side benefit: the test
  harness and the real feature share one proven implementation instead of two).

This is deliberately a blunt instrument — it reseeds **every** random draw the app makes for that
session, including things that feel unrelated to football (the Easter-egg name generator's
`Math.random()<0.04` roll, cosmetic flavor-text picks, etc.). That's actually exactly correct here:
the whole point is that if both players make identical choices, they get a **byte-identical**
career, full stop, and the moment either player makes a different choice (a different respin, a
different pick), only *their own* subsequent draws diverge — the other player's client never needs
to know or care, because each client owns its own independent copy of the seeded generator.

**Implementation refinement, discovered while actually building this (not changed in the plan
above, narrowed):** the seeded window only needs to cover **Combine + Draft Night**, not the whole
career. "The exact same rolls in order" is specifically about the blind build/draft comparison —
who built the better prospect, and (since draft order is itself seeded) who landed the better draft
slot with it. Once a real `career` object exists and a season actually starts simulating, there is
no requirement — and no practical way without a much bigger undertaking — to keep two
independently-played, possibly-days-apart careers deterministically in lockstep for their whole
multi-season length; each player's own season-by-season play (injuries, development swings, AI
behavior) runs on genuine, unseeded randomness from that point on, exactly like solo play always
has. Concretely: `installSeededRandom(seed)` fires the moment "Start My Combine" is clicked;
`restoreRandom()` fires the moment "Report to Camp" (`startCareerBtn`) is clicked, right before the
first season's own simulation begins. This also means a **resumed** multiplayer career needs no
seed or decade carried forward at all — only which save key to point at — which is what makes
resuming across real-world days/devices trivial instead of needing the seed to somehow survive a
save/reload.

**This one piece is the same cost regardless of Track A or B**, and should be built and verified
completely on its own, in isolation, before either track's own UI work starts — it's the load-bearing
piece of the entire feature. Verification is cheap and exactly matches this project's own established
norm: seed two headless runs identically, walk them through the identical click sequence, assert
byte-identical `career` objects; then diverge one click and confirm they diverge from exactly that
point forward, never before it.

## 3. The blind draft/combine mechanic (shared by both tracks)

Given section 2, "blind" falls out almost for free: **each client is simply an ordinary solo
Combine/draft session, seeded from a shared value neither player controls alone.** The comparison
underneath is unchanged — the same 12-round player-card grid, the same `finishCombine()` →
`computeCombineScore()` → draft-night flow. Two real restrictions were added on top once this
actually shipped (not in the original pass above, tightened after a direct follow-up request):

- **Mode is forced to Blind, never Classic**, for the whole duration of a multiplayer Combine.
  "Best player available" judged blind, on name/reputation alone, is the entire premise of a fair
  comparison — Classic mode showing the actual attribute rolls up front would let a player simply
  read off the answer instead of judging it, defeating the point of a blind draft entirely.
- ~~No respins of any kind~~ **reversed by a direct follow-up**: respins (the free era/player
  respin, the ad-earned bonus pool) are available in multiplayer exactly as in solo play. The
  restriction that stuck is "Run it back" below — a genuinely different button, and per the
  follow-up, the one that actually mattered for keeping the comparison fair.
- **No "Run it back" either** — a genuinely separate button from the respins above: the Results
  screen (after all 12 rounds are picked) has its own `#playAgainBtn`, literally labeled "Run it
  back," that discards the whole build and starts the Combine over from scratch. Left available,
  it would have been the bigger loophole of the two — a player unhappy with their build could just
  keep redoing the entire Combine until landing on something better, no matter how tightly the
  per-round respins were restricted. Hidden outright for a multiplayer Combine; "Draft Prospect" and
  "Copy build" (a harmless share action) are unaffected.

Plus the two additions the original pass already called for:

- A **Match Setup** screen, reached from a new "Multiplayer" menu entry, where the seed is created
  or entered (see track-specific flows below) before the Combine begins.
- A stamp on the resulting `career` object: `career.multiplayerMatchId` (the shared match id/seed)
  and `career.multiplayerSlot` (`"A"` or `"B"`) — needed later purely for the comparison screen to
  find and label the right two saves; it has no gameplay effect at all.

Separately, once an actual career exists, **Fast-Forward is also unavailable** for the life of a
multiplayer career (each season is meant to be played through deliberately, matching the "no
shortcuts on the Combine side either" spirit) — the season-actions row simply omits that button
when `career.multiplayerMatchId` is set.

Genuinely blind is guaranteed by construction in Track A (the players are never looking at the same
screen at the same time) and needs one explicit design rule in Track B (section 7B): **neither
client ever transmits or receives the other's picks during the Combine/draft phase** — only
match-level bookkeeping (who's in, whose turn to ready-up) crosses the wire until both sides report
"my build is locked in."

## 4. Post-draft simulation mode: the "(a) or (b)" fork, mapped fully both ways

### 4A. Parallel Universe Mode (two independent leagues) — recommended default

Each player's build lives in **its own ordinary, complete, 32-team (era-appropriate) league**,
exactly like solo play today — own AI rivals, own schedule, own front office, own everything. The
only thing shared between the two is the seed that produced the draft class both players picked
from. **This requires zero changes to the core sim engine.** The entire feature reduces to:
seed-sharing (section 2), a way to hold or exchange two finished-or-in-progress career summaries,
and a comparison screen (section 5) that reads both and renders a scoreboard. Every existing system
— development, contracts, Key Moments, the achievement ledger, awards — works completely unmodified
for both players independently.

Trade-off, stated honestly: the two players' QBs can never actually play a real game against each
other, and it's technically possible (if unlikely, since the draft-order logic keys off overall
grade which both players are trying to maximize identically) for both to be drafted 1st overall by
the same team in their own respective universes — which is fine and expected, since these are
two separate worlds, not a shared one.

### 4B. Same League Mode (true head-to-head, real shared universe) — a much bigger rewrite

Both human QBs would exist inside **one single simulated league**, potentially even facing each
other in a real, played-out game. This sounds like a smaller ask than it is: **the entire codebase's
`career` object and every function that reads it currently assumes exactly one human-controlled QB
per league** — `career.teamId`, `career.oline`, the entire "the player's own real playoff path,
paced by the Key Moment reveal" mechanism, `career.leagueRivals`/`leagueDepthCharts` (which model
every OTHER QB as a lighter-weight simulated entity, not a second full human perspective) — none of
it has a slot for "there are two of these." Real requirements this would introduce:

- The engine needs to track and render **two parallel hero narratives** inside one league
  simultaneously — two Season tabs, two sets of Key Moment reveals, two front offices — essentially
  running the whole per-season interactive flow **twice per season**, once per human, before either
  can advance.
- **Draft collision handling**: if both builds are strong enough to be early picks, what happens
  when they'd both be the top prospect? Something has to break the tie (alternate priority? a
  blind "who picked further down the board" comparison? never let them land on the same team?).
- **A real head-to-head game** between the two QBs' teams needs actual two-sided play-by-play —
  today, only the human's OWN games get a real simulated box score; every other matchup (including,
  in this mode, the other human's games against AI) is abstracted via `simpleWinProb`/
  `simulateGameScore`'s single-sided model. A real two-human game needs a genuinely two-sided
  simulation the engine doesn't have today.
- **Save/session architecture**: this is no longer "two independent saves," it's one shared league
  save both clients need a consistent view of — which is where Track B's real-time sync
  requirement (section 7B) stops being optional infrastructure and becomes load-bearing gameplay
  state, not just a comparison convenience.

**Recommendation: build 4A first, treat 4B as an explicit stretch/future item**, not because it's
uninteresting but because it is closer to "a second game mode built on top of a rewritten core
engine" than a feature addition — a Round-4-development-overhaul-scale undertaking (see
PROGRESS.md's own Round 4 entry for the precedent of how big a "let's rethink this system" ask can
get), not a multiplayer-specific cost. If 4B is ever pursued, it should get its own dedicated
planning pass once 4A has shipped and proven there's real demand for the mode at all.

## 5. Winner determination: a composite score, reusing this codebase's own established philosophy

This project has already solved "how do you compare very different careers fairly" twice —
the Hall of Fame verdict tiers and the Round 32 All-Time leaderboard's GOAT tiers both exist
specifically to rank career quality without just counting raw totals. The Balance Wave 5 rewrite of
MVP scoring is the most relevant precedent of all: it exists **specifically because raw
counting-stat/win totals reward a long, unremarkable career over a short, brilliant one**, and
fixed it with a weighted composite of rate-and-context-aware components instead of raw sums. A
head-to-head score should follow the same philosophy, not reinvent one:

**Proposed starting weights** (a first proposal to tune from real output, per this project's own
diagnostic-driven-calibration norm — not a final answer):

| Component | Weight | Why | Reuses |
|---|---|---|---|
| Championships (rings) | 30% | The sport's actual goal | `career.totals.rings` |
| Individual accolades (MVP/All-Pro/Pro Bowl, weighted 3/2/1) | 25% | Recognized excellence, not just longevity | `career.totals.mvps/allPros/proBowls` |
| Peak + career-average quality (peak overall, career passer rating) | 20% | Rate-based, so a short brilliant career isn't buried by a long mediocre one — the exact Wave 5 lesson | `peakOverall`, `passerRating(...)` |
| Career totals (yards, TD, games) | 10% | Longevity still counts for something, just not everything | `career.totals.*` |
| Achievements earned | 10% | A fun, already-built proxy for "did interesting/rare things" — genuinely differentiates two otherwise-similar statlines | `career.achievements.unlocked` (Wave 6/7's 85-achievement registry) |
| Earnings | 5% | Mostly a byproduct of the above; minor tiebreaker weight only | `career.totals.earnings` |

**A comparison-point problem to solve explicitly, not silently**: comparing an in-progress
5-season build to a finished 20-season Hall of Famer isn't fair to either player. Two honest
options: **(i)** only ever compare two careers once **both have ended** (retired/released/banned/
HOF), which is simplest and matches how the Trophy Room already only records finished careers, or
**(ii)** support a snapshot comparison "as of season N" for players who want a running scoreboard
mid-match, which needs the scoring formula to be well-defined on a still-active `career` object too
(all the same fields exist mid-career, so this is a formula question, not a data-availability one).
Recommend shipping **(i)** first — it's strictly simpler and the natural fit for Parallel Universe
Mode — and treating **(ii)** as a nice-to-have once the core loop is proven.

## 6. Data model additions (both tracks)

- `career.multiplayerMatchId` / `career.multiplayerSlot` — stamped at creation, read-only,
  gameplay-inert (section 3).
- A new **Match record**, shape sketched below, distinct from any individual `career`:
  ```js
  {
    matchId: "ABCD-1234",       // the human-shareable code
    seed: "<the actual PRNG seed derived from/alongside matchId>",
    createdAt, mode: "parallel" | "sameLeague",   // 4A vs 4B
    track: "private" | "public",                   // A vs B, section 7
    players: {
      A: { name, status: "drafting"|"in-progress"|"finished", summary: null | <scoring inputs> },
      B: { name, status: ..., summary: null | <scoring inputs> },
    },
  }
  ```
- `<scoring inputs>` is a small, purpose-built summary object (rings, mvps/allPros/proBowls, peak
  overall, rating, totals, achievement count, earnings) — deliberately NOT the entire `career`
  object, both to keep an exported/shared code small and because the other player never needs (or
  should get) the fine-grained detail of your build, only the scoring-relevant summary. This is
  the exact same instinct behind why `saveTrophyRoomEntry`'s entry shape is already a curated
  summary and not a dump of the whole career.

## 7. Track A — Private Match (recommended near-term build)

No backend, no accounts, no networking of any kind. The "network" is the players themselves,
copy-pasting a short code through whatever channel they already use to talk to each other.

**Flow:**
1. Player A: Menu → "Multiplayer" → "Create Private Match" → app generates a match code (encodes
   the seed) → shown on screen to copy/share.
2. Player A plays their entire Combine → draft → career, exactly like solo play, seeded from that
   match's seed (section 2).
3. Player A shares the code with Player B out-of-band (text, Discord, whatever).
4. Player B: Menu → "Multiplayer" → "Join Private Match" → pastes the code → their Combine is
   seeded identically → plays their own career independently, on their own time, own device.
5. Once a career **ends** (section 5's comparison-point rule) for a player, the app offers
   **"Export My Result"** — a second short code (base64-encoded JSON of the `<scoring inputs>`
   summary, matchId included) to paste back to the other player, or post somewhere both can see.
6. Either player can then **"Compare Results"**, pasting in the other side's result code, to see
   the head-to-head scoreboard (section 5) rendered locally — no server ever involved.

This is a strict, self-contained extension of the existing local-only architecture — same
`localStorage`-only persistence model this whole project already committed to, just with two
short human-copyable strings (match code, result code) standing in for what a server would
otherwise coordinate.

## 8. Track B — Public Match (the real online multiplayer version)

This is the one piece that genuinely requires the backend this project has explicitly deferred
building. Mapped fully, as requested, not hand-waved:

**New infrastructure needed (none of which exists today):**
- **An account/identity layer** — public matchmaking needs *some* persistent identity even if
  minimal (a display name + a stable device/account id), since "two strangers" can't coordinate via
  a copy-pasted code the way two friends can.
- **A matchmaking service** — a queue: players who want a public match join it, get paired, and are
  both handed the same match id/seed by the SERVER (not generated client-side, since neither
  stranger should be trusted to hand the other a fair, un-tampered seed).
- **A realtime sync channel** per match (WebSocket or equivalent) carrying only match-level
  bookkeeping during the blind phase — "Player B has joined," "Player A is ready," "Player B has
  locked in their build" — **never** picks or build details themselves, preserving blindness by the
  same rule as section 3.
- **Server-authoritative result submission**: each client reports its own final `<scoring inputs>`
  summary to the server once finished (not to the other player directly) — the server computes and
  broadcasts the final head-to-head result once **both** sides have reported in, which also closes
  an obvious cheating vector Track A can't fully close on its own (a player editing their own
  exported result code before sharing it) — public/competitive play needs that server-side trust
  boundary; private play between friends does not.
- **Anti-cheat consideration specific to this game**: since so much of this app's logic
  (development rolls, injury rolls, etc.) currently runs entirely client-side with no server
  validation of any kind, a fully honest public leaderboard would eventually need at least the
  FINAL scoring inputs (not the whole simulation) validated server-side against the shared seed —
  itself a much larger undertaking (replaying or checksumming a client's RNG-consumption trace)
  that should be scoped separately and honestly flagged as **not solved by this document** if
  public play ever heads toward a real ranked leaderboard rather than casual matchmaking.

**Everything from sections 2-6 (the PRNG mechanism, the blind mechanic, the 4A/4B fork, the scoring
formula, the data shapes) is identical between Track A and Track B** — Track B is a strict
superset that swaps "two humans coordinating a code by hand" for "a server coordinating it for
them," and swaps "paste your result code to compare" for "the server compares them for you and
tells both clients." Nothing in the core game design changes between the two; only the delivery
mechanism for match setup and result reporting does.

## 9. New UI/screens needed (both tracks, additively)

- Menu: new "Multiplayer" entry, placed with the other primary actions (Start the Combine/Trophy
  Room/Achievements). A same-day follow-up briefly moved this whole action row above the hero
  headline/lede, then moved it back below that copy per a further follow-up — it now sits directly
  under the intro text, same relative position the menu always had, just alongside Multiplayer.
- Match Setup screen: Track A shows Create/Join with a code field; Track B shows
  Find Match / matchmaking status instead.
- **Combine Setup screen (solo path)**, added once this actually shipped: Mode (Classic/Blind) and
  Key Moments are no longer a persistent menu-level toggle — they're asked on a dedicated screen
  shown right after "Start the Combine" is clicked, before the Combine itself begins. Multiplayer's
  own Create/Join screens ask their own equivalent: Key Moments only (a personal, per-player
  preference, not part of the shared match code — it only affects that player's own playoff
  mini-game, never anything about the shared seed), since Mode is forced to Blind for multiplayer
  and isn't a real choice there.
- A small persistent "Multiplayer Match" indicator during play (so a player mid-Combine/career
  remembers which match they're in, especially if they also have solo saves going).
- Result/Export screen (Track A) or automatic result screen (Track B) once a career ends.
- Head-to-head Scoreboard screen: the two `<scoring inputs>` summaries rendered side by side per
  section 5's weighted table, with a clear overall winner declaration — visually, this is a natural
  extension of the existing Trophy Room table/HOF hero card idioms, not a new visual language.

## 10. Phased build roadmap (if this is ever greenlit)

1. **Phase 0 (prerequisite, track-agnostic)**: `src/sim/prng.js`, a real seeded-RNG module;
   `installSeededRandom` production-ified; verified byte-identical-given-identical-choices,
   diverges-from-first-differing-choice, exactly as section 2 describes. Nothing user-facing yet.
2. **Phase 1 (Track A, Parallel Universe Mode — the whole realistic MVP)**: Match Setup
   (create/join by code), the `career.multiplayerMatchId`/`multiplayerSlot` stamp, the
   `<scoring inputs>` summary + export/import result codes, the Scoreboard screen with the
   proposed weighted formula (tuned from real playtested output, per this project's own
   diagnostic-driven norm).
3. **Phase 2 (polish)**: mid-career "as of season N" snapshot comparisons (section 5's option ii),
   a nicer Match Setup/lobby feel, achievement-aware flavor text on the Scoreboard.
4. **Phase 3 (only with real demonstrated demand)**: Track B's backend — accounts, matchmaking,
   realtime sync, server-authoritative result submission — is its own multi-week infrastructure
   project, not a Phase-3-of-this-feature checkbox; treat greenlighting it as the same order of
   decision as this project's own prior "turning this into an app" call, not a minor addition.
5. **Phase 4 (explicit stretch, not scoped in detail here)**: 4B Same League Mode, once 4A has
   shipped and there's a real reason to fund the core-engine rewrite section 4B honestly describes.

## 11. Open questions still worth the user's own call, not assumed here

- The exact scoring weights in section 5's table are a first proposal, not a decision — worth a
  real diagnostic sweep (feed the formula a handful of hand-built "career archetypes" — a
  short-and-brilliant one, a long-and-mediocre one, a ring-heavy-but-statistically-average one —
  and confirm the ranking matches what a person would intuitively call "the better career," the
  same way Wave 5's MVP formula was validated against the brief's own worked example) before
  locking it in.
- Comparison-point rule (section 5): finished-careers-only (recommended, simpler) vs. also
  supporting a running mid-career snapshot comparison.
- Whether the era/decade choice should be **forced identical** for both players (it almost
  certainly should — the Combine, prospect pool, and era-specific difficulty curve all key off
  decade choice, and "same rolls" only means something if both players are looking at the same
  underlying game) — worth stating as an explicit constraint in Match Setup rather than leaving it
  implicit.
- Whether Track A's result-code export should be human-readable/inspectable (easier to trust, easier
  to accidentally tamper with) or opaque/checksummed (harder to casually edit, matches the
  "friendly honor system" framing better without needing Track B's full server trust boundary).

---

## 12. Deep dive: Private + Parallel Universe Mode, full operational flow

Everything Track A (section 7) and Mode 4A (section 4A) already established, walked start-to-finish
as one concrete sequence, with the specific mechanics filled in that the high-level pass left open.

### 12.1 Match creation (Player A)

1. Menu → **Multiplayer** → **Private Match** → **Create New Match**.
2. **Era/decade is chosen here, once, by the creator, and locked into the match.** This has to
   happen before anything else: the Combine's prospect pool, respin economy, and era-specific
   difficulty curve all key off decade, and "the exact same rolls" only means something if both
   players are looking at the same underlying game (this was flagged as an open question in section
   11; for Parallel Mode specifically, recommend just deciding it here — the creator picks, no vote
   needed, since Player B is about to freely choose to join or not).
3. The app generates a **match code** — recommend a short, easy-to-read/say/type string (e.g.
   6 base32 characters, avoiding visually-ambiguous characters like `0`/`O`/`1`/`I`) that **encodes
   the seed and decade directly** — there is no server to look anything up in, so the code has to be
   fully self-describing. No separate "seed" the user ever sees; the code *is* the seed, packaged.
4. Player A sees a **Match Code screen**: the code in large copyable text, a "Copy Code" button, and
   plain language about what Private mode does and does not enforce:
   > "Share this code with your opponent. Once you're both in, you'll each draft blind from an
   > identical pool — don't watch each other's screen or stream until you've both locked in your
   > build. This game can't stop you from peeking; it's on the honor system."
5. Player A clicks **Start My Combine** → `installSeededRandom(seed)`-equivalent runs, the ordinary
   Combine/draft/career flow begins completely unchanged, and the resulting `career` object gets
   `career.multiplayerMatchId = code` / `career.multiplayerSlot = "A"` stamped once it exists.

### 12.2 Match joining (Player B)

1. Menu → **Multiplayer** → **Private Match** → **Join Match** → paste the code.
2. App decodes seed + decade, shows a one-line confirmation ("Joining a 1990s match — created by a
   friend") and a **Start My Combine** button. No handshake, no "waiting for the other player" —
   Player B can join and play the instant they have the code, entirely on their own schedule.
3. Same seeded Combine/draft/career flow, stamped `multiplayerSlot = "B"`.

### 12.3 Local save-slot separation (a real, small architecture change)

The existing single `gridironlab.activeCareer` key can't hold two saves at once. Multiplayer saves
get their own namespaced key: `gridironlab.activeCareer.mp.<matchId>.<slot>`. Solo play is
completely untouched — it keeps using the plain `gridironlab.activeCareer` key exactly as today, so
this is purely additive, zero regression risk to existing saves. This incidentally also means:

- One device can hold **any number of concurrent multiplayer matches** (plus one ordinary solo
  save) without collision — useful if the same two friends want to run three private matches at
  once, or if one player is mid-match-A while also mid-match-B with a different opponent.
- The menu needs a new **"Active Multiplayer Matches"** list (alongside the existing solo
  "Resume career" strip) enumerating every `mp.*` key present, each resumable independently.

### 12.4 Independent play — genuinely nothing changes

Both players just play ordinary solo careers from here. No synchronization, no time pressure, no
"waiting on the other player" at any point — this is Parallel Mode's entire appeal. Every existing
system (development plans, contracts, Key Moments, the achievement ledger, awards) works completely
unmodified, for both players, independently. A player can be five seasons in while the other hasn't
even started their Combine yet, and that's fine.

### 12.5 Finishing and exporting a result

1. When a `multiplayerMatchId`-stamped career reaches any of the existing end states
   (`finishCareer()`'s retirement/release/ban/HOF paths), the app builds the small
   `<scoring inputs>` summary described in section 6, in addition to (not instead of) the normal
   Trophy Room entry.
2. Offers **Export Result Code** — the summary, base64-encoded, with a small trailing checksum
   character so a mis-copied paste is caught immediately ("this code looks corrupted — check for a
   missing character") rather than silently producing a wrong comparison.
3. This should be **re-accessible later**, not just at the exact moment the career ends — surfaced
   from the "Active Multiplayer Matches" list (now showing "Finished — Export Result") in case the
   player navigates away before copying the code.

### 12.6 Comparing results

1. Either player, whenever they have both codes in hand: Menu → **Multiplayer** → **Compare
   Results** → paste in both result codes (their own, auto-filled if it exists locally; the other
   player's, pasted in).
2. App validates both codes decode to the **same `matchId`** (refuses to compare two unrelated
   matches by mistake) before computing anything.
3. Renders the **Scoreboard screen** — section 5's weighted composite side by side, a declared
   winner, and the full component breakdown so the loser can see exactly where the gap was. This
   computation happens **entirely locally, on whichever device runs it** — no server, and either
   player can do it independently once they have both codes.

### 12.7 Honest limitations, stated plainly rather than glossed over

- **Blindness is honor-system only.** Nothing technical stops Player A from watching Player B's
  screen. This is an accepted trade-off of building this with no server at all, consistent with
  Private mode's whole framing as "for two people who trust each other."
- **Result codes are similarly unenforceable** — nothing stops a player from hand-editing their own
  exported code before sharing it. The checksum catches accidental corruption, not deliberate
  tampering. This is precisely the gap Track B's server-authoritative result submission (section 8)
  exists to close for public/competitive play; Private mode simply doesn't need that guarantee for
  its intended two-friends use case.
- **No mid-match check-in by default** — comparison only makes sense once both careers have ended
  (section 5's recommended comparison-point rule). A "how am I doing right now" running comparison
  is a real, buildable Phase 2 nice-to-have (section 5, option ii), not part of this core loop.

---

## 13. Deep dive: Private + Same League Mode, full operational flow

This is a genuinely different, harder shape than section 12 — worth being direct about why. Parallel
Mode's two careers never share mutable state, so two independent local saves compared at the end is
sufficient. Same League Mode's two careers **share one league** — team assignments, depth charts,
the schedule, possibly a real game between the two of them — which is **mutable shared state**, and
without a server, there is exactly one way to keep a single canonical copy of mutable shared state
consistent between two people: **only one side ever holds the live copy at a time, and it gets
handed to the other side explicitly between turns.** That's not a workaround bolted onto the design;
it's the actual shape Private + Same League has to take. Two ways to realize it:

### 13.1 Two ways to hand off the shared state

**(i) Same-device hot-seat.** Both players are physically together, sharing one device, and pass it
back and forth between turns (once per season, or even more granularly). Simple to build — a
"whose turn" gate plus a "pass the device — Player B's turn, look away until it's your go" hand-off
screen (a heavier-grained version of the same screen idea floated for the original combine-blindness
question). Cost: both players need to be together for the **entire multi-season duration** of the
match, which is a much bigger time commitment than Parallel Mode ever asks for.

**(ii) Play-by-file (recommended for Private specifically).** Both players own separate devices and
pass **the shared league save itself** back and forth as a file/code after each turn — the same
spirit as a play-by-mail board game. Player A plays their season's worth of decisions, then
**Ends Turn**, which exports the updated shared save (a real file download this time, not a short
pasteable string — a full multi-team league state is too large for that) for Player B to import;
Player B plays their turn, exports, sends back to A; repeat for the life of the match. This preserves
the "play on your own schedule" freedom that's Private mode's whole reason for existing, at the cost
of needing real file export/import plumbing (bigger than Parallel Mode's small result-code string,
but still fully local — no server, no hosting, just a downloaded/re-uploaded file passed hand to
hand exactly like the match code was).

Recommendation: build **(ii)**, offer **(i)** as a lighter-weight option for two people who happen
to already be in the same room and don't want to deal with file passing.

### 13.2 The merge step: from two blind builds into one shared league

Sections 3/12.1-12.2's blind-Combine mechanic is **identical** here — both players still each run
their own seeded Combine independently and lock in a build with no visibility into the other's
picks. What's new is what happens **after** both builds are locked in, since Same League Mode can't
just let each player spin up their own independent 32-team league the way Parallel Mode does:

1. Once **both** builds are locked in (the play-by-file hand-off model naturally gates this: the
   match literally can't proceed to a shared league until both halves exist), **one** league is
   generated from the shared seed — same AI teams/rivals/schedule generation this app already does
   for solo play, just run once, into the shared save, instead of twice into two separate ones.
2. **Both human builds are inserted into that one draft class together**, alongside the ordinary
   AI-generated prospects, and the **existing draft-order logic runs once, for real, across all of
   them** — whichever build grades higher goes earlier, exactly like solo draft order already works.
   This is the most faithful reading of "best player available, blind, then see who actually built
   the better prospect" — a real, mechanical answer to "who's better," not a coin flip.
3. **Same-team collision** (both builds landing on the same team) needs an explicit house rule.
   Two real options, not just one to avoid the question:
   - **(a) Bump rule**: if the draft would place both builds on the same team, the second one bumps
     to the next-highest-rated available team instead. Simple, predictable, avoids the collision
     outright.
   - **(b) Let it happen — competition for the job**: allow the collision and let the *existing*
     backup/incumbent-competition mechanic (`resolveBackupCompetition` and friends, already built
     for the solo-game's own bench-QB situations) decide who starts. This is thematically the
     richest possible outcome of this whole mode — "you and your rival got drafted by the same team
     and now you're literally competing for the same job" — and reuses a system that already exists
     rather than building something new. Recommend **(b)** as the more interesting default, with
     **(a)** available as a "no thanks, keep us on separate teams" match-setup toggle for players
     who'd find the collision frustrating rather than fun.

### 13.3 Turn structure once the league exists

- The shared save carries `{ league: <the 32-team world state>, heroes: { A: <careerA>, B:
  <careerB> }, turnOrder: "A" | "B", matchId, seed }` — each hero's own data stays **exactly** the
  shape a solo `career` object already is; nothing about the per-player data model changes, it's
  just addressed as `.heroes.A` instead of being the top-level save. This matters because it means
  every existing per-player system (development, contracts, Key Moments, achievements) needs zero
  changes to work inside this wrapper.
- **One season per turn** is the natural grain (matches how the game already thinks in season-sized
  chunks): Player A advances their own season fully (all their own interstitials, Key Moments,
  offseason plan), then explicitly **Ends Turn**; Player B does the same for theirs; once both have
  taken their turn for a given league-year, the shared league itself advances to the next year
  (AI teams/rivals sim their seasons, free agency resolves league-wide, etc.) before the next A/B
  turn pair begins.
- Unlike Parallel Mode, this is turn-based/asynchronous **by necessity**, never simultaneous —
  worth setting that expectation plainly in the mode's own description so players don't expect
  Parallel Mode's "play whenever, totally independently" freedom here.

### 13.4 The hardest unsolved wrinkle: a real head-to-head game between A and B

If the shared schedule ever pairs the two humans' teams against each other (division rivals, a
playoff matchup), the engine hits a real, honest limit: **today, only the human player's own games
get a real simulated box score — every other matchup is abstracted through a single-sided win-
probability/score model.** A genuine two-sided interactive game (both players' own Key Moments
mattering in the same play) would require re-architecting the in-season simulation as fully
two-sided, which is its own large project, not a Same-League-specific detail to solve here.

A pragmatic **house rule for a v1**, rather than pretending the engine already supports this: when
the schedule pairs A vs B, whichever player's turn comes first that week resolves the matchup using
the existing single-sided engine (their own offense/Key-Moments) against a **frozen snapshot of the
other player's team grades as of their last completed turn** — not a truly live, simultaneous game,
but a fair once-computed result that gets applied identically to both players' copies of the save
once it's passed along, so there's never two conflicting accounts of what happened in that game.
This is an explicit, named simplification, not a bug — worth stating as a match-setup rule
("head-to-head matchups are resolved by whoever's turn comes first that week") rather than leaving
players to discover and be confused by it.

### 13.5 Scoring bonus unique to Same League Mode

Everything from section 5 still applies at the end exactly as written — but Same League Mode can
additionally track a genuine **head-to-head record** between the two builds (if their schedules ever
crossed), which Parallel Mode structurally can never offer. Worth surfacing as a small explicit
bonus/tiebreaker in the Scoreboard screen ("Won the season series 2-0") even if it doesn't move the
main weighted score much — it's the one piece of bragging rights this mode uniquely earns.

### 13.6 Honest comparison to Parallel Mode, for whoever's deciding what to actually build

| | Parallel (12) | Same League (13) |
|---|---|---|
| Core-engine changes needed | None | League-generation run once instead of twice; draft-order logic extended to a shared class; a same-team collision house rule |
| Synchronization model | None — fully independent, play whenever | Turn-based hand-off required for the life of the match |
| New data plumbing | Small result-code string, once, at the end | Full shared-league save, exported/imported every single turn |
| Can the two builds ever actually play each other | No | Yes, via an explicit frozen-snapshot house rule (13.4) |
| Time commitment shape | Fully flexible | Bounded by how promptly the other player takes their turn |
| Build cost | The realistic near-term MVP (Phase 1) | Meaningfully larger — closer to a Phase 3/4 undertaking even confined to Private, mostly because of 13.2's draft-merge logic and 13.4's head-to-head house rule, not because of anything backend-related |

Recommendation unchanged from the original pass: **build 12 (Private + Parallel) first.** Section 13
is fully mapped out as requested, but it's real, additional scope even with the backend question set
aside entirely — the hard parts of Same League Mode were never really about needing a server, they
were always about there being two humans in one shared, mutable simulation at all.
