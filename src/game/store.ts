/**
 * Zustand store — a thin shell over the pure engine.
 *
 * All game logic lives in engine.ts. This file only holds the current state,
 * dispatches engine calls, and handles the one genuinely impure concern:
 * persisting the vocabulary record across sessions.
 */
import { create } from 'zustand'
import * as engine from './engine'
import levelData from '../data/levels/level-001.json'
import type { GameState, Level } from './types'

// JSON import widens `direction` to string, so the shape needs asserting.
export const LEVEL_ONE = levelData as unknown as Level

const LEARNED_KEY = 'wordgrid.learned.v1'

function readLearned(): string[] {
  try {
    const raw = localStorage.getItem(LEARNED_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((w): w is string => typeof w === 'string') : []
  } catch {
    // Private browsing and disabled storage both throw. A lost history is not
    // worth breaking the game over.
    return []
  }
}

function writeLearned(words: readonly string[]): void {
  try {
    localStorage.setItem(LEARNED_KEY, JSON.stringify(words))
  } catch {
    /* non-fatal */
  }
}

interface Store {
  game: GameState
  /** Vocabulary learned across every session, not just this level. */
  lifetimeLearned: string[]
  selectLetter: (poolIndex: number) => void
  undoLetter: () => void
  clearSelection: () => void
  submitWord: () => void
  showPrompt: (word: string) => void
  dismissPanels: () => void
  resetLevel: () => void
}

export const useGame = create<Store>((set, get) => ({
  game: engine.createGame(LEVEL_ONE),
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
    writeLearned(merged)
    set({ game, lifetimeLearned: merged })
  },

  resetLevel: () => set({ game: engine.createGame(LEVEL_ONE) }),
}))
