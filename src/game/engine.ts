/**
 * The game engine.
 *
 * Every function here is PURE: no React, no DOM, no randomness, no I/O. State
 * goes in, new state comes out. That is what makes the game exhaustively
 * testable, and it is why swapping tap input for swipe later will touch one
 * component and nothing in this file.
 */
import { isSubMultiset } from './anagram'
import type {
  Cell,
  GameState,
  Level,
  PlacedWord,
  SubmitResult,
  WordEntry,
} from './types'

export const MIN_WORD_LENGTH = 3

export function createGame(level: Level): GameState {
  return {
    level,
    selection: [],
    solved: [],
    foundBonus: [],
    learned: [],
    promptWord: null,
    selectedWord: null,
    lastResult: null,
  }
}

/** The word currently assembled in the tray. */
export function currentWord(state: GameState): string {
  return state.selection.map((i) => state.level.pool[i]).join('')
}

export function gridWords(level: Level): string[] {
  return level.placed.map((p) => p.word)
}

/**
 * Append a pool tile to the selection.
 *
 * Selection stores INDICES, not letters. That is the whole trick for duplicate
 * tiles: LACONIC's two Cs are index 2 and index 6, so CONIC can consume both
 * while a re-tap of the same index is correctly rejected.
 */
export function selectLetter(state: GameState, poolIndex: number): GameState {
  if (poolIndex < 0 || poolIndex >= state.level.pool.length) return state
  if (state.selection.includes(poolIndex)) return state
  return {
    ...state,
    selection: [...state.selection, poolIndex],
    // Any new input retires the previous panel — but NOT the board highlight,
    // which is most useful precisely while the word is being built.
    lastResult: null,
    promptWord: null,
  }
}

export function undoLetter(state: GameState): GameState {
  if (state.selection.length === 0) return state
  return { ...state, selection: state.selection.slice(0, -1) }
}

export function clearSelection(state: GameState): GameState {
  if (state.selection.length === 0) return state
  return { ...state, selection: [] }
}

/** Show the definition-as-prompt for an unsolved grid word. */
export function showPrompt(state: GameState, word: string): GameState {
  const target = word.toUpperCase()
  if (!gridWords(state.level).includes(target)) return state
  if (state.solved.includes(target)) return state
  return { ...state, promptWord: target, selectedWord: target, lastResult: null }
}

export function dismissPanels(state: GameState): GameState {
  return { ...state, promptWord: null, selectedWord: null, lastResult: null }
}

/**
 * Classify a candidate word without mutating anything.
 *
 * A word in the grid or bonus list but missing an `entries` record is a level
 * data bug; it resolves to `invalid` here so the game never crashes, and
 * `validateLevel` catches it at build time where it belongs.
 */
export function resolveWord(state: GameState, rawWord: string): SubmitResult {
  const word = rawWord.toUpperCase()
  if (word.length < MIN_WORD_LENGTH) return { kind: 'tooShort', word }

  const entry = state.level.entries[word]
  const inGrid = gridWords(state.level).includes(word)
  const inBonus = state.level.bonus.includes(word)

  if (!entry || (!inGrid && !inBonus)) return { kind: 'invalid', word }

  if (inGrid) {
    if (state.solved.includes(word)) return { kind: 'already', word }
    return { kind: 'solved', word, entry }
  }

  if (state.foundBonus.includes(word)) return { kind: 'already', word }
  return { kind: 'bonus', word, entry }
}

/** Submit the assembled word and apply its consequences. */
export function submitWord(state: GameState): GameState {
  const word = currentWord(state)
  const result = resolveWord(state, word)

  const next: GameState = {
    ...state,
    selection: [],
    promptWord: null,
    // Submitting ends the attempt, so the highlight goes with it.
    selectedWord: null,
    lastResult: result,
  }

  if (result.kind === 'solved') {
    next.solved = [...state.solved, result.word]
  } else if (result.kind === 'bonus') {
    next.foundBonus = [...state.foundBonus, result.word]
  } else {
    return next
  }

  // Only teaching-band words enter the vocabulary record. Silence on common
  // words is what gives the teaching moments their weight.
  if (result.entry.band === 'teaching' && !state.learned.includes(result.word)) {
    next.learned = [...state.learned, result.word]
  }

  return next
}

export function isComplete(state: GameState): boolean {
  return gridWords(state.level).every((w) => state.solved.includes(w))
}

/** Teaching-band words found this level, in discovery order. */
export function learnedEntries(state: GameState): WordEntry[] {
  return state.learned
    .map((w) => state.level.entries[w])
    .filter((e): e is WordEntry => e !== undefined)
}

function walk(placed: PlacedWord): Array<{ row: number; col: number; letter: string }> {
  return [...placed.word].map((letter, i) => ({
    row: placed.direction === 'down' ? placed.row + i : placed.row,
    col: placed.direction === 'across' ? placed.col + i : placed.col,
    letter,
  }))
}

/**
 * Build the render grid. A square is revealed if ANY word through it is
 * solved — so a crossing letter earned by one word stays visible for the
 * other, which is what makes the grid feel like it is filling in.
 */
export function buildCells(level: Level, solved: readonly string[]): Array<Array<Cell | null>> {
  const grid: Array<Array<Cell | null>> = Array.from({ length: level.rows }, () =>
    Array.from({ length: level.cols }, () => null),
  )

  for (const placed of level.placed) {
    const isSolved = solved.includes(placed.word)
    for (const { row, col, letter } of walk(placed)) {
      const existing = grid[row]?.[col]
      if (existing) {
        existing.revealed = existing.revealed || isSolved
        existing.words.push(placed.word)
      } else if (grid[row]) {
        grid[row][col] = { row, col, letter, revealed: isSolved, words: [placed.word] }
      }
    }
  }

  return grid
}

/**
 * Structural checks on level data. Used by unit tests now and by the
 * build-time validator in Phase 4.
 */
export function validateLevel(level: Level): string[] {
  const problems: string[] = []
  const words = gridWords(level)

  if (!words.includes(level.baseWord)) {
    problems.push(`base word ${level.baseWord} is not placed in the grid`)
  }
  if (level.entries[level.baseWord]?.band !== 'teaching') {
    problems.push(`base word ${level.baseWord} must be in the teaching band`)
  }
  if (new Set(words).size !== words.length) {
    problems.push('duplicate word placed in the grid')
  }

  for (const word of [...words, ...level.bonus]) {
    if (!level.entries[word]) problems.push(`${word} has no dictionary entry`)
    // The defining constraint of the genre: every word must be spellable from
    // the shared pool, duplicate counts included.
    if (!isSubMultiset(word, level.pool)) {
      problems.push(`${word} cannot be spelled from the pool ${level.pool.join('')}`)
    }
  }

  if (level.baseWord.length !== level.pool.length) {
    problems.push('base word must use every tile in the pool')
  }

  const overlap = level.bonus.filter((w) => words.includes(w))
  if (overlap.length > 0) {
    problems.push(`bonus words also placed in grid: ${overlap.join(', ')}`)
  }

  // Every letter written into a square must agree with every word crossing it.
  const seen = new Map<string, string>()
  for (const placed of level.placed) {
    if (placed.word.length < MIN_WORD_LENGTH) {
      problems.push(`${placed.word} is shorter than the ${MIN_WORD_LENGTH}-letter minimum`)
    }
    for (const { row, col, letter } of walk(placed)) {
      if (row < 0 || row >= level.rows || col < 0 || col >= level.cols) {
        problems.push(`${placed.word} runs outside the ${level.rows}x${level.cols} grid`)
        continue
      }
      const key = `${row},${col}`
      const prior = seen.get(key)
      if (prior && prior !== letter) {
        problems.push(`crossing conflict at ${key}: ${prior} vs ${letter}`)
      }
      seen.set(key, letter)
    }
  }

  return problems
}
