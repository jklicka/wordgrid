# WordGrid

A vocabulary-first word game. Wordscapes-style letter wheel over a crossword
grid — but where Wordscapes pays you in coins, WordGrid pays you in definitions.

```bash
npm install
npm run dev        # http://localhost:5180
```

## The idea

Two mechanics carry the whole product:

**Definition-as-prompt.** Tap an unsolved square and its definition appears —
you are solving *"which word means this?"* from the letter pool. Without this,
players stall on exactly the unfamiliar words worth teaching, because you
cannot discover `LACONIC` by swiping if you have never seen it.

**Definition-as-reward.** Solve a word and the full entry appears: word, part
of speech, definition, example. Every teaching word joins a persistent
**Words Learned** list, reviewed at level end — because showing a definition
once teaches nothing.

## The band rule

The most important content rule in the game:

| Band | Frequency | On solve |
| --- | --- | --- |
| `common` | rank < 5k | Fills the grid, checkmark only, **no panel** |
| `teaching` | 5k–20k | Full definition panel + Words Learned |
| `rare` | > 20k | Excluded from generation |

If `CAT` fired the definition panel, players would learn to ignore it within a
dozen levels and the mechanic would be dead. Silence on common words is what
gives the teaching moments their weight.

Bonus words — valid sub-anagrams *not* in the grid — follow the same rule, so
discovering `CONICAL` teaches even though it never touches the grid.

## Architecture

```
src/game/engine.ts     PURE functions. No React, no DOM, no randomness.
src/game/anagram.ts    Signature + multiset-subset helpers.
src/game/store.ts      Zustand shell + localStorage persistence.
src/components/        Presentation only.
src/data/levels/       Level JSON (hand-built for now, generated in Phase 4).
tools/                 Build-time scripts. Never shipped.
```

Everything outside `engine.ts` is a thin shell over it. That is what makes the
game exhaustively testable, and why replacing tap input with swipe in Phase 6
will touch exactly one component.

Selection stores **pool indices, not letters**. That is the whole trick for
duplicate tiles: `LACONIC` has two `C`s, so `CONIC` consumes both correctly
while a re-tap of the same tile is rejected.

## Content pipeline

Levels are generated at build time and committed. Players receive only the
level JSON — the 4.4 MB word list and the WordNet database never ship.

```bash
npm run content          # words → levels → validate
```

| Step | What it does |
| --- | --- |
| `tools/bootstrap-zipf.py` | **Run once.** Emits `data/zipf.json` from `wordfreq`. Committed, so the Node pipeline never needs Python. |
| `content:words` | Joins WordNet 3.0 to those frequencies → `data/wordlist.json` (18k words, gitignored — rebuilt in seconds) |
| `content:levels` | Base word → sub-anagrams → interlocked grid → `src/data/levels/` |
| `content:validate` | Build gate. A malformed level fails the build rather than reaching a player. |

**Why generation is a build step, not a runtime one:** the candidate pool for a
given base word is a few dozen words, not 18,000, so valid interlocks are hard
to find — roughly 1 base word in 17 yields a usable level. Offline, discarding
failures costs nothing. At runtime it would be unusable.

**Three things the data taught us, none of which were guessable:**

- A frequency corpus built from subtitles is useless here. Measured against a
  50k OpenSubtitles list, *every* word this game exists to teach — `laconic`,
  `ersatz`, `quotidian`, `loci` — was absent, while ordinary words like `ion`
  and `coil` sat mid-table. `wordfreq`'s blended corpus separates them cleanly.
- WordNet's `index.*` files lowercase every lemma, so proper nouns and acronyms
  are invisible there. The first generated level was built on `AUGUSTA` with
  `GSA`/`TSA`/`USA` as bonus words. The `data.*` files preserve casing, which
  is the filter that works.
- Short words need to be commoner to earn their place. Every useful 3-letter
  word scores ≥3.5 Zipf; the junk WordNet carries at that length (`IVA`, `LAV`,
  `LEU`) sits below.

## Testing

```bash
npm run test       # vitest (44) + level validation
npm run test:e2e   # playwright on WebKit at iPhone 13 (10 tests)
npm run typecheck
```

E2E runs at mobile viewport only — testing this game at desktop width would be
testing a layout no player uses. Unit tests assert against a frozen fixture
(`tests/fixtures/level-laconic.json`) so regenerating content cannot break
them; e2e derives its subjects from the real level data for the same reason.

## Roadmap

| Phase | Status |
| --- | --- |
| 0–3 · Playable level, tap input, full vocabulary loop | ✅ done |
| 4 · WordNet word list + level generator + validator + 20 levels | ✅ done |
| 5 · PWA, offline, daily level, streak, stats | next |
| 6 · Swipe-to-connect; pool ramp 5→7 letters | |
| 7 · Capacitor wrap → App Store (needs Xcode 26) | |

## License

MIT — see [LICENSE](LICENSE). Third-party data notices: [NOTICE](NOTICE).

## Attribution

Definitions, parts of speech and examples in `src/data/levels/` are derived
from **WordNet 3.0**, Princeton University, used under its licence. That
licence requires the copyright notice to travel with all copies, so it appears
in [NOTICE](NOTICE) and in the app's own credits screen. Princeton University
is not affiliated with, and does not endorse, this app.

Word frequency bands derive from **wordfreq** (MIT). Only a computed Zipf value
per word is retained; no source corpus is redistributed.
