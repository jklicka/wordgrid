/**
 * Zustand store — a thin shell over the pure engine.
 *
 * All game logic lives in engine.ts. This file only holds current state,
 * dispatches engine calls, and handles the two genuinely impure concerns:
 * loading level content, and persisting progress across sessions.
 */
import { create } from 'zustand'
import * as engine from './engine'
import type { GameState, Level } from './types'

/** Levels are generated into src/data/levels/ and committed. Glob-importing
 *  them means adding a level is a content change, never a code change. */
const modules = import.meta.glob('../data/levels/level-*.json', { eager: true }) as Record<
  string,
  { default: unknown }
>

export const LEVELS: Level[] = Object.keys(modules)
  .sort() // ids are zero-padded, so lexical order is level order
  .map((k) => modules[k].default as Level)

const LEARNED_KEY = 'wordgrid.learned.v1'
const PROGRESS_KEY = 'wordgrid.level.v1'

function read<T>(key: string, fallback: T, parse: (raw: unknown) => T | null): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return parse(JSON.parse(raw)) ?? fallback
  } catch {
    // Private browsing and disabled storage both throw. Losing progress is not
    // worth breaking the game over.
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* non-fatal */
  }
}

const readLearned = () =>
  read<string[]>(LEARNED_KEY, [], (v) =>
    Array.isArray(v) ? v.filter((w): w is string => typeof w === 'string') : null,
  )

const readLevelIndex = () =>
  read<number>(PROGRESS_KEY, 0, (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < LEVELS.length ? v : null,
  )

interface Store {
  game: GameState
  levelIndex: number
  /** Vocabulary learned across every session, not just this level. */
  lifetimeLearned: string[]
  selectLetter: (poolIndex: number) => void
  undoLetter: () => void
  clearSelection: () => void
  submitWord: () => void
  showPrompt: (word: string) => void
  dismissPanels: () => void
  restartLevel: () => void
  nextLevel: () => void
  hasNextLevel: () => boolean
}

const startIndex = readLevelIndex()

export const useGame = create<Store>((set, get) => ({
  game: engine.createGame(LEVELS[startIndex]),
  levelIndex: startIndex,
  lifetimeLearned: readLearned(),

  selectLetter: (poolIndex) => set({ game: engine.selectLetter(get().game, poolIndex) }),
  undoLetter: () => set({ game: engine.undoLetter(get().game) }),
  clearSelection: () => set({ game: engine.clearSelection(get().game) }),
  showPrompt: (word) => set({ game: engine.showPrompt(get().game, word) }),
  dismissPanels: () => set({ game: engine.dismissPanels(get().game) }),

  submitWord: () => {
    const game = engine.submitWord(get().game)
    const merged = [...get().lifetimeLearned]
    for (const word of game.learned) {
      if (!merged.includes(word)) merged.push(word)
    }
    write(LEARNED_KEY, merged)
    set({ game, lifetimeLearned: merged })
  },

  restartLevel: () => set({ game: engine.createGame(LEVELS[get().levelIndex]) }),

  hasNextLevel: () => get().levelIndex + 1 < LEVELS.length,

  nextLevel: () => {
    const next = get().levelIndex + 1
    if (next >= LEVELS.length) return
    write(PROGRESS_KEY, next)
    set({ levelIndex: next, game: engine.createGame(LEVELS[next]) })
  },
}))
