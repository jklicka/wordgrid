import { describe, expect, it } from 'vitest'
import { isSubMultiset, letterCounts, signature } from '../../src/game/anagram'

const LACONIC = ['L', 'A', 'C', 'O', 'N', 'I', 'C']

describe('signature', () => {
  it('is stable across anagrams', () => {
    expect(signature('LACONIC')).toBe(signature('CONICAL'))
  })

  it('is case-insensitive', () => {
    expect(signature('laconic')).toBe(signature('LACONIC'))
  })

  it('distinguishes different letter multisets', () => {
    expect(signature('CONIC')).not.toBe(signature('CONICAL'))
  })
})

describe('letterCounts', () => {
  it('counts duplicates', () => {
    expect(letterCounts(LACONIC).get('C')).toBe(2)
    expect(letterCounts(LACONIC).get('L')).toBe(1)
  })
})

describe('isSubMultiset', () => {
  it('accepts the full pool', () => {
    expect(isSubMultiset('LACONIC', LACONIC)).toBe(true)
    expect(isSubMultiset('CONICAL', LACONIC)).toBe(true)
  })

  it('accepts proper subsets', () => {
    for (const word of ['CONIC', 'CALICO', 'LOCI', 'LION', 'ION', 'CAN', 'OIL']) {
      expect(isSubMultiset(word, LACONIC), word).toBe(true)
    }
  })

  // The bug this whole helper exists to prevent: a naive
  // `every(l => pool.includes(l))` would pass all three of these.
  it('respects duplicate counts', () => {
    expect(isSubMultiset('CONIC', LACONIC)).toBe(true) // two Cs available
    expect(isSubMultiset('CCC', LACONIC)).toBe(false) // only two Cs
    expect(isSubMultiset('LLAMA', LACONIC)).toBe(false) // one L, one A
    expect(isSubMultiset('CLINIC', LACONIC)).toBe(false) // needs two Is
  })

  it('rejects letters not in the pool', () => {
    expect(isSubMultiset('ZINC', LACONIC)).toBe(false)
  })

  it('rejects the empty word', () => {
    expect(isSubMultiset('', LACONIC)).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isSubMultiset('conic', LACONIC)).toBe(true)
  })
})
