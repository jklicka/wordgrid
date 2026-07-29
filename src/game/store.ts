/**
 * Zustand store — the impure shell.
 *
 * All game logic lives in engine.ts and progress.ts, both pure. This file only
 * holds current state and owns the three things that cannot be pure: loading
 * level content, reading the clock, and persisting to localStorage.
 */
import { create } from 'zustand'
import * as engine from './engine'
import * as progress from './progress'
import type { Progress } from './progress'
import type { GameState, Level } from './types'

/**
 * Levels are generated into src/data/levels/ and loaded LAZILY.
 *
 * Eager-globbing them compiled 400 levels straight into the JS bundle — 1.4 MB
 * of content masquerading as code, growing linearly with the catalogue. Lazy
 * glob gives each level its own chunk: the app boots on one level and the
 * service worker still precaches the rest for offline play.
 */
const loaders = import.meta.glob('../data/levels/level-*.json') as Record<
  string,
  () => Promise<{ default: unknown }>
>

/** Zero-padded ids, so lexical order is level order. */
const LEVEL_KEYS = Object.keys(loaders).sort()
export const LEVEL_COUNT = LEVEL_KEYS.length

export async function loadLevel(index: number): Promise<Level> {
  const key = LEVEL_KEYS[Math.min(Math.max(index, 0), LEVEL_KEYS.length - 1)]
  return (await loaders[key]()).default as Level
}

const STORE_KEY = 'wordgrid.progress.v2'
/** Pre-v2 keys, read once so existing players keep their words and place. */
const LEGACY_LEARNED = 'wordgrid.learned.v1'
const LEGACY_LEVEL = 'wordgrid.level.v1'

export type Mode = 'ladder' | 'daily'

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Progress>
      return { ...progress.EMPTY_PROGRESS, ...parsed }
    }
    // Migrate from the v1 keys rather than silently resetting someone's
    // vocabulary record.
    const learned = JSON.parse(localStorage.getItem(LEGACY_LEARNED) ?? '[]')
    const levelIndex = JSON.parse(localStorage.getItem(LEGACY_LEVEL) ?? '0')
    return {
      ...progress.EMPTY_PROGRESS,
      learned: Array.isArray(learned) ? learned.filter((w) => typeof w === 'string') : [],
      levelIndex: typeof levelIndex === 'number' && levelIndex >= 0 ? levelIndex : 0,
    }
  } catch {
    // Private browsing and disabled storage both throw. Losing progress is not
    // worth breaking the game over.
    return progress.EMPTY_PROGRESS
  }
}

function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p))
  } catch {
    /* non-fatal */
  }
}

/** Read fresh every time — the app can sit open across midnight. */
const today = () => progress.dayKey(new Date())

const clampIndex = (i: number) => Math.min(Math.max(i, 0), Math.max(LEVEL_COUNT - 1, 0))

interface Store {
  /** Null only while the first level's chunk is in flight. */
  game: GameState | null
  progress: Progress
  mode: Mode
  /** Level currently loaded, by index into LEVELS. */
  levelIndex: number

  selectLetter: (poolIndex: number) => void
  undoLetter: () => void
  clearSelection: () => void
  submitWord: () => void
  showPrompt: (word: string) => void
  dismissPanels: () => void

  restartLevel: () => void
  nextLevel: () => void
  /** Load a level chunk and start it. */
  goTo: (index: number, mode: Mode) => Promise<void>
  hasNextLevel: () => boolean
  startDaily: () => void
  startLadder: () => void

  streak: () => number
  dailyIndex: () => number
  dailyDoneToday: () => boolean
}

const initial = loadProgress()
const startIndex = clampIndex(initial.levelIndex)

export const useGame = create<Store>((set, get) => ({
  game: null,
  progress: initial,
  mode: 'ladder',
  levelIndex: startIndex,

  selectLetter: (i) => { const g = get().game; if (g) set({ game: engine.selectLetter(g, i) }) },
  undoLetter: () => { const g = get().game; if (g) set({ game: engine.undoLetter(g) }) },
  clearSelection: () => { const g = get().game; if (g) set({ game: engine.clearSelection(g) }) },
  showPrompt: (w) => { const g = get().game; if (g) set({ game: engine.showPrompt(g, w) }) },
  dismissPanels: () => { const g = get().game; if (g) set({ game: engine.dismissPanels(g) }) },

  submitWord: () => {
    const before = get().game
    if (!before) return
    const game = engine.submitWord(before)

    let next = progress.addLearned(get().progress, game.learned)

    // Record the completion exactly once — on the transition, not on every
    // subsequent submit against an already-finished level.
    if (engine.isComplete(game) && !engine.isComplete(before)) {
      next = progress.recordCompletion(next, today(), { isDaily: get().mode === 'daily' })
    }

    if (next !== get().progress) saveProgress(next)
    set({ game, progress: next })
  },

  goTo: async (index, mode) => {
    const level = await loadLevel(index)
    set({ levelIndex: index, mode, game: engine.createGame(level) })
  },

  restartLevel: () => { void get().goTo(get().levelIndex, get().mode) },

  hasNextLevel: () => get().mode === 'ladder' && get().levelIndex + 1 < LEVEL_COUNT,

  nextLevel: () => {
    const next = clampIndex(get().levelIndex + 1)
    if (next === get().levelIndex) return
    const p = { ...get().progress, levelIndex: next }
    saveProgress(p)
    set({ progress: p })
    void get().goTo(next, 'ladder')
  },

  startDaily: () => { void get().goTo(progress.dailyLevelIndex(today(), LEVEL_COUNT), 'daily') },

  startLadder: () => { void get().goTo(clampIndex(get().progress.levelIndex), 'ladder') },

  streak: () => progress.currentStreak(get().progress, today()),
  dailyIndex: () => progress.dailyLevelIndex(today(), LEVEL_COUNT),
  dailyDoneToday: () => progress.isDailyDone(get().progress, today()),
}))

/**
 * The active game, for components rendered inside App's loaded gate.
 * Non-null by construction there — nothing below the gate mounts until the
 * first level chunk has resolved.
 */
export const useActiveGame = () => useGame((s) => s.game!)

// Boot: load the level the player left off on.
void useGame.getState().goTo(startIndex, 'ladder')
