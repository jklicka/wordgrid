import { describe, expect, it } from 'vitest'
// A frozen fixture, not generated content: these tests assert on specific
// words, and content regeneration must not be able to break them.
import levelData from '../fixtures/level-laconic.json'
import {
  buildCells,
  clearSelection,
  createGame,
  currentWord,
  gridWords,
  isComplete,
  learnedEntries,
  resolveWord,
  selectLetter,
  showPrompt,
  submitWord,
  undoLetter,
  validateLevel,
} from '../../src/game/engine'
import type { GameState, Level } from '../../src/game/types'

const LEVEL = levelData as unknown as Level

const fresh = () => createGame(LEVEL)

/** Type a word by consuming the first free pool tile for each letter. */
function type(state: GameState, word: string): GameState {
  let next = state
  for (const letter of word.toUpperCase()) {
    const idx = next.level.pool.findIndex((l, i) => l === letter && !next.selection.includes(i))
    if (idx === -1) throw new Error(`cannot type "${word}": no free ${letter}`)
    next = selectLetter(next, idx)
  }
  return next
}

const play = (state: GameState, word: string) => submitWord(type(state, word))

describe('level data', () => {
  it('passes structural validation', () => {
    expect(validateLevel(LEVEL)).toEqual([])
  })

  it('catches a crossing conflict', () => {
    const broken: Level = {
      ...LEVEL,
      placed: [...LEVEL.placed, { word: 'CAN', row: 0, col: 2, direction: 'across' }],
    }
    expect(validateLevel(broken).join(' ')).toContain('crossing conflict')
  })

  it('catches a word that cannot be spelled from the pool', () => {
    const broken: Level = { ...LEVEL, bonus: [...LEVEL.bonus, 'ZINC'] }
    expect(validateLevel(broken).join(' ')).toContain('cannot be spelled')
  })
})

describe('letter selection', () => {
  it('starts empty', () => {
    expect(currentWord(fresh())).toBe('')
  })

  it('builds a word in tap order', () => {
    expect(currentWord(type(fresh(), 'LION'))).toBe('LION')
  })

  // Selection stores indices precisely so the two Cs behave independently.
  it('consumes both duplicate tiles for CONIC', () => {
    const state = type(fresh(), 'CONIC')
    expect(currentWord(state)).toBe('CONIC')
    expect(new Set(state.selection).size).toBe(5)
  })

  it('ignores re-tapping the same tile', () => {
    const once = selectLetter(fresh(), 2)
    expect(selectLetter(once, 2)).toBe(once)
    expect(currentWord(selectLetter(once, 2))).toBe('C')
  })

  it('ignores out-of-range indices', () => {
    const state = fresh()
    expect(selectLetter(state, -1)).toBe(state)
    expect(selectLetter(state, 99)).toBe(state)
  })

  it('undoes the last letter only', () => {
    expect(currentWord(undoLetter(type(fresh(), 'LION')))).toBe('LIO')
  })

  it('undo on an empty selection is a no-op', () => {
    const state = fresh()
    expect(undoLetter(state)).toBe(state)
  })

  it('clears the whole selection', () => {
    expect(currentWord(clearSelection(type(fresh(), 'LION')))).toBe('')
  })
})

describe('resolveWord', () => {
  it('classifies a grid word as solved', () => {
    expect(resolveWord(fresh(), 'LACONIC').kind).toBe('solved')
  })

  it('classifies a non-grid sub-anagram as bonus', () => {
    expect(resolveWord(fresh(), 'CONICAL').kind).toBe('bonus')
  })

  it('rejects words under three letters', () => {
    expect(resolveWord(fresh(), 'ON').kind).toBe('tooShort')
  })

  it('rejects unrecognized words', () => {
    expect(resolveWord(fresh(), 'CLON').kind).toBe('invalid')
  })

  it('reports a repeat as already found', () => {
    expect(resolveWord(play(fresh(), 'LACONIC'), 'LACONIC').kind).toBe('already')
  })

  it('is case-insensitive', () => {
    expect(resolveWord(fresh(), 'laconic').kind).toBe('solved')
  })
})

describe('submitWord and the band rule', () => {
  it('records a teaching grid word as learned', () => {
    const state = play(fresh(), 'LACONIC')
    expect(state.solved).toEqual(['LACONIC'])
    expect(state.learned).toEqual(['LACONIC'])
  })

  // The rule the whole product rests on: common words fill the grid but teach
  // nothing, so the panel keeps its meaning.
  it('fills a common grid word without recording it as learned', () => {
    const state = play(fresh(), 'LION')
    expect(state.solved).toEqual(['LION'])
    expect(state.learned).toEqual([])
  })

  it('records a teaching bonus word as learned without filling the grid', () => {
    const state = play(fresh(), 'CONICAL')
    expect(state.solved).toEqual([])
    expect(state.foundBonus).toEqual(['CONICAL'])
    expect(state.learned).toEqual(['CONICAL'])
  })

  it('does not record a common bonus word', () => {
    const state = play(fresh(), 'COIN')
    expect(state.foundBonus).toEqual(['COIN'])
    expect(state.learned).toEqual([])
  })

  it('keeps learned words in discovery order without duplicates', () => {
    let state = play(fresh(), 'CONIC')
    state = play(state, 'LACONIC')
    state = play(state, 'LOCI')
    state = play(state, 'CONIC')
    expect(state.learned).toEqual(['CONIC', 'LACONIC', 'LOCI'])
  })

  it('clears the selection whether the word is accepted or rejected', () => {
    expect(play(fresh(), 'LACONIC').selection).toEqual([])
    expect(play(fresh(), 'CLON').selection).toEqual([])
  })

  it('leaves progress untouched on a rejection', () => {
    const state = play(play(fresh(), 'LACONIC'), 'CLON')
    expect(state.solved).toEqual(['LACONIC'])
    expect(state.lastResult?.kind).toBe('invalid')
  })

  it('exposes learned entries with full definitions', () => {
    const entries = learnedEntries(play(fresh(), 'LACONIC'))
    expect(entries).toHaveLength(1)
    expect(entries[0].definition).toContain('very few words')
    expect(entries[0].example).toBeTruthy()
  })
})

describe('prompts', () => {
  it('shows the prompt for an unsolved grid word', () => {
    expect(showPrompt(fresh(), 'LACONIC').promptWord).toBe('LACONIC')
  })

  it('refuses a prompt for an already-solved word', () => {
    expect(showPrompt(play(fresh(), 'LACONIC'), 'LACONIC').promptWord).toBeNull()
  })

  it('refuses a prompt for a bonus word — those must be discovered cold', () => {
    expect(showPrompt(fresh(), 'CONICAL').promptWord).toBeNull()
  })

  it('is retired by the next letter tap', () => {
    const prompted = showPrompt(fresh(), 'LACONIC')
    expect(selectLetter(prompted, 0).promptWord).toBeNull()
  })
})

describe('completion', () => {
  it('needs every grid word, and bonus words do not count', () => {
    let state = play(fresh(), 'CONICAL')
    expect(isComplete(state)).toBe(false)
    for (const word of gridWords(LEVEL)) state = play(state, word)
    expect(isComplete(state)).toBe(true)
  })
})

describe('buildCells', () => {
  it('lays every placed word onto the grid', () => {
    const cells = buildCells(LEVEL, [])
    expect(cells[2][0]?.letter).toBe('L')
    expect(cells[2][6]?.letter).toBe('C')
    expect(cells[0][2]?.letter).toBe('L')
    expect(cells[4][5]?.letter).toBe('N')
  })

  it('leaves squares outside any word empty', () => {
    expect(buildCells(LEVEL, [])[0][0]).toBeNull()
  })

  it('hides letters until their word is solved', () => {
    expect(buildCells(LEVEL, [])[2][0]?.revealed).toBe(false)
    expect(buildCells(LEVEL, ['LACONIC'])[2][0]?.revealed).toBe(true)
  })

  // A crossing letter earned by one word must stay visible for the other —
  // that is what makes the grid feel like it is filling in.
  it('keeps a crossing square revealed via either word', () => {
    const viaAcross = buildCells(LEVEL, ['LACONIC'])
    expect(viaAcross[2][2]?.revealed).toBe(true)
    expect(viaAcross[2][2]?.words).toEqual(expect.arrayContaining(['LACONIC', 'LOCI']))

    const viaDown = buildCells(LEVEL, ['LOCI'])
    expect(viaDown[2][2]?.revealed).toBe(true)
    expect(viaDown[0][2]?.revealed).toBe(true)
  })
})
