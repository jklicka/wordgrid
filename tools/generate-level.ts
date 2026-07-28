/**
 * Generate levels into src/data/levels/.
 *
 *   npx tsx tools/generate-level.ts [count]
 *
 * Shape of a level: one teaching-band base word supplies the letter pool; a
 * handful of its sub-anagrams interlock into a crossword grid; every remaining
 * sub-anagram becomes a recognised bonus word.
 *
 * This runs at BUILD time, which is the whole point. The candidate pool for a
 * given base word is a few dozen words rather than 24,000, so valid interlocks
 * are hard to find and most base words fail outright. Offline that costs
 * nothing — discard and try the next. At runtime it would be unusable.
 */
import fs from 'node:fs'
import path from 'node:path'
import { isSubMultiset } from '../src/game/anagram'
import { validateLevel } from '../src/game/engine'
import type { Direction, Level, PlacedWord, WordEntry } from '../src/game/types'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT_DIR = path.join(ROOT, 'src', 'data', 'levels')

const POOL_MIN = 5
const POOL_MAX = 7
const MIN_GRID_WORDS = 4
const MAX_GRID_WORDS = 7
const MIN_TEACHING_PER_LEVEL = 2

/** A phone grid. The first run produced an 11x9 board that would need
 *  pinch-zoom on any handset. */
const MAX_ROWS = 8
const MAX_COLS = 8

/** Unbounded bonus lists produced levels with 100 bonus words and 55 teaching
 *  moments — a dictionary dump, not a 2-4 minute level. Keep the most
 *  discoverable ones and drop the tail. */
const MAX_BONUS = 10

/** Seeded PRNG so regenerating produces identical levels — build artifacts
 *  should be reproducible, and a diff full of reshuffled grids is noise. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Entry = WordEntry & { zipf: number; signature: string }
const WORDS: Record<string, Entry> = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'wordlist.json'), 'utf8'),
)
const ALL = Object.values(WORDS)

// ---------------------------------------------------------------------------
// Grid assembly

interface Cell {
  letter: string
  row: number
  col: number
}

class Grid {
  cells = new Map<string, Cell>()
  placed: PlacedWord[] = []

  private key(r: number, c: number) {
    return `${r},${c}`
  }
  at(r: number, c: number) {
    return this.cells.get(this.key(r, c))
  }

  /**
   * Can `word` sit at (row,col) running `dir` without creating anything the
   * player would read as an unintended entry?
   *
   * Three rules, and the second is the one that bites if you skip it:
   *   1. every overlap must agree on its letter
   *   2. a non-overlapping cell may not touch existing letters sideways —
   *      otherwise two words end up glued into a nonsense entry
   *   3. the squares immediately before and after must be empty
   */
  fits(word: string, row: number, col: number, dir: Direction): boolean {
    const dr = dir === 'down' ? 1 : 0
    const dc = dir === 'across' ? 1 : 0
    let overlaps = 0

    // Rule 3 — no letter butting up against either end.
    if (this.at(row - dr, col - dc) || this.at(row + dr * word.length, col + dc * word.length)) {
      return false
    }

    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i
      const c = col + dc * i
      const existing = this.at(r, c)

      if (existing) {
        if (existing.letter !== word[i]) return false // rule 1
        overlaps++
      } else {
        // Rule 2 — perpendicular neighbours must be clear.
        const [pr, pc] = dir === 'across' ? [1, 0] : [0, 1]
        if (this.at(r - pr, c - pc) || this.at(r + pr, c + pc)) return false
      }
    }

    // Must connect to what's already there, but not lie entirely on top of it.
    return overlaps >= 1 && overlaps < word.length
  }

  place(word: string, row: number, col: number, dir: Direction) {
    const dr = dir === 'down' ? 1 : 0
    const dc = dir === 'across' ? 1 : 0
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i
      const c = col + dc * i
      this.cells.set(this.key(r, c), { letter: word[i], row: r, col: c })
    }
    this.placed.push({ word, row, col, direction: dir })
  }

  /** Every placement where `word` could legally go. */
  candidates(word: string): Array<{ row: number; col: number; dir: Direction }> {
    const out: Array<{ row: number; col: number; dir: Direction }> = []
    for (const cell of this.cells.values()) {
      for (let i = 0; i < word.length; i++) {
        if (word[i] !== cell.letter) continue
        for (const dir of ['across', 'down'] as Direction[]) {
          const row = dir === 'down' ? cell.row - i : cell.row
          const col = dir === 'across' ? cell.col - i : cell.col
          if (this.fits(word, row, col, dir)) out.push({ row, col, dir })
        }
      }
    }
    return out
  }

  /** Shift everything so the top-left of the bounding box is (0,0). */
  normalize(): { rows: number; cols: number; placed: PlacedWord[] } {
    const rs = [...this.cells.values()].map((c) => c.row)
    const cs = [...this.cells.values()].map((c) => c.col)
    const minR = Math.min(...rs)
    const minC = Math.min(...cs)
    return {
      rows: Math.max(...rs) - minR + 1,
      cols: Math.max(...cs) - minC + 1,
      placed: this.placed.map((p) => ({ ...p, row: p.row - minR, col: p.col - minC })),
    }
  }
}

// ---------------------------------------------------------------------------

/** Words spellable from the base word's letters, longest first. */
function subAnagrams(base: string): Entry[] {
  const pool = [...base]
  return ALL.filter((e) => e.word !== base && e.word.length >= 3 && isSubMultiset(e.word, pool)).sort(
    (a, b) => b.word.length - a.word.length,
  )
}

function tryBuild(base: Entry, rand: () => number): Level | null {
  const subs = subAnagrams(base.word)
  if (subs.length < MIN_GRID_WORDS + 2) return null // need fill AND bonus words

  const grid = new Grid()
  grid.place(base.word, 0, 0, 'across')

  // Longest first — long words are hardest to place, so committing to them
  // early avoids deep backtracking. Among equal lengths prefer the more common
  // word, which makes the grid feel solvable rather than obscure.
  const pool = [...subs].sort((a, b) => b.word.length - a.word.length || b.zipf - a.zipf)

  const inGrid = new Set([base.word])
  for (const cand of pool) {
    if (grid.placed.length >= MAX_GRID_WORDS) break
    if (inGrid.has(cand.word)) continue
    const spots = grid.candidates(cand.word)
    if (spots.length === 0) continue
    const spot = spots[Math.floor(rand() * spots.length)]
    grid.place(cand.word, spot.row, spot.col, spot.dir)
    inGrid.add(cand.word)
  }

  if (grid.placed.length < MIN_GRID_WORDS) return null

  const { rows, cols, placed } = grid.normalize()
  if (rows > MAX_ROWS || cols > MAX_COLS) return null

  // Most discoverable bonus words first; the long tail is noise.
  const bonus = subs
    .filter((e) => !inGrid.has(e.word))
    .sort((a, b) => b.zipf - a.zipf)
    .slice(0, MAX_BONUS)
    .map((e) => e.word)
  if (bonus.length === 0) return null

  const entries: Record<string, WordEntry> = {}
  for (const w of [...inGrid, ...bonus]) {
    const { zipf: _z, signature: _s, ...entry } = WORDS[w]
    entries[w] = entry
  }

  const teaching = [...inGrid, ...bonus].filter((w) => WORDS[w].band === 'teaching').length
  if (teaching < MIN_TEACHING_PER_LEVEL) return null

  return {
    id: '',
    baseWord: base.word,
    pool: [...base.word],
    rows,
    cols,
    placed,
    bonus,
    entries,
  }
}

// ---------------------------------------------------------------------------

const count = Number(process.argv[2] ?? 20)
const rand = mulberry32(20260728)

const bases = ALL.filter(
  (e) =>
    e.band === 'teaching' &&
    e.word.length >= POOL_MIN &&
    e.word.length <= POOL_MAX &&
    new Set(e.word).size >= 4, // avoid pools dominated by one repeated letter
).sort((a, b) => b.zipf - a.zipf) // most familiar teaching words become early levels

fs.mkdirSync(OUT_DIR, { recursive: true })
for (const f of fs.readdirSync(OUT_DIR)) {
  if (/^level-\d+\.json$/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f))
}

const levels: Level[] = []
let attempts = 0
let rejectedByValidator = 0

for (const base of bases) {
  if (levels.length >= count) break
  attempts++
  const level = tryBuild(base, rand)
  if (!level) continue

  level.id = `level-${String(levels.length + 1).padStart(3, '0')}`
  const problems = validateLevel(level)
  if (problems.length > 0) {
    rejectedByValidator++
    continue
  }
  levels.push(level)
  fs.writeFileSync(path.join(OUT_DIR, `${level.id}.json`), JSON.stringify(level, null, 2) + '\n')
}

const extraTeaching = levels.map(
  (l) =>
    [...l.placed.map((p) => p.word), ...l.bonus].filter((w) => l.entries[w].band === 'teaching')
      .length,
)
const avg = extraTeaching.reduce((a, b) => a + b, 0) / (extraTeaching.length || 1)

console.log(`wrote ${levels.length} levels to src/data/levels/`)
console.log(`  base words tried:      ${attempts}`)
console.log(`  rejected by validator: ${rejectedByValidator}`)
console.log(`  grid words per level:  ${Math.min(...levels.map((l) => l.placed.length))}-${Math.max(...levels.map((l) => l.placed.length))}`)
console.log(`  bonus words per level: ${Math.min(...levels.map((l) => l.bonus.length))}-${Math.max(...levels.map((l) => l.bonus.length))}`)
console.log(`  teaching words/level:  ${Math.min(...extraTeaching)}-${Math.max(...extraTeaching)} (avg ${avg.toFixed(1)})`)
