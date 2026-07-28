/**
 * Core game types.
 *
 * `band` is the single most important content concept in the game: it decides
 * whether solving a word is a teaching moment or silent scaffolding. If every
 * word fired the definition panel, CAT and ACT would train players to ignore
 * it and the whole vocabulary mechanic would die.
 */
export type Band = 'common' | 'teaching' | 'rare'

export type Direction = 'across' | 'down'

export interface WordEntry {
  word: string
  /** Part of speech, display-ready: "adj.", "n.", "v." */
  pos: string
  /** Short form, shown as the challenge prompt on an unfilled slot. */
  gloss: string
  /** Full form, shown as the reward after solving. */
  definition: string
  example?: string
  band: Band
}

/** A word placed into the grid at a position. */
export interface PlacedWord {
  word: string
  row: number
  col: number
  direction: Direction
}

export interface Level {
  id: string
  /** Letter tiles. May contain duplicates — LACONIC has two Cs. */
  pool: string[]
  /** The headline lesson: uses every tile, always in the `teaching` band. */
  baseWord: string
  rows: number
  cols: number
  placed: PlacedWord[]
  /** Valid sub-anagrams that are NOT in the grid. Wordscapes pays these in
   *  coins; we pay them in definitions. */
  bonus: string[]
  /** Definitions for every recognized word, grid and bonus alike. */
  entries: Record<string, WordEntry>
}

export type SubmitResult =
  | { kind: 'solved'; word: string; entry: WordEntry }
  | { kind: 'bonus'; word: string; entry: WordEntry }
  | { kind: 'already'; word: string }
  | { kind: 'tooShort'; word: string }
  | { kind: 'invalid'; word: string }

export interface GameState {
  level: Level
  /** Indices into `level.pool`. Indices, not letters — that is what makes
   *  duplicate tiles (the two Cs) behave correctly. */
  selection: number[]
  /** Grid words found so far. */
  solved: string[]
  /** Bonus words found so far. */
  foundBonus: string[]
  /** Teaching-band words found, in discovery order. This is the vocabulary
   *  record — the thing that actually persists and makes this a learning
   *  product rather than a crossword with a footnote. */
  learned: string[]
  /** Which grid word's prompt is currently displayed, if any. */
  promptWord: string | null
  /** Outcome of the most recent submit, for the UI to react to. */
  lastResult: SubmitResult | null
}

/** One rendered grid square. */
export interface Cell {
  row: number
  col: number
  letter: string
  revealed: boolean
  /** Words passing through this square. */
  words: string[]
}
