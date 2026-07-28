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

## Testing

```bash
npm run test       # vitest — engine + anagram (44 tests)
npm run test:e2e   # playwright on WebKit at iPhone 13 (8 tests)
npm run typecheck
```

E2E runs at mobile viewport only. Testing this game at desktop width would be
testing a layout no player uses.

## Roadmap

| Phase | Status |
| --- | --- |
| 0–3 · Playable level, tap input, full vocabulary loop | ✅ done |
| 4 · WordNet word list + level generator + validator | next |
| 5 · PWA, offline, daily level, streak, stats | |
| 6 · Swipe-to-connect; pool ramp 5→7 letters | |
| 7 · Capacitor wrap → App Store (needs Xcode 26) | |

## Attribution

Definitions in the shipped word list derive from **WordNet 3.1**, Princeton
University. WordNet is free for commercial use provided its copyright notice
travels with all copies; that notice ships in the in-app credits screen.
Princeton's name is not used in promotion of this app.
