/**
 * Anagram helpers. Pure, and shared between the runtime engine and the
 * build-time level generator in tools/.
 */

/** Sorted-letters key. This is the index the level generator lives on. */
export function signature(word: string): string {
  return word.toUpperCase().split('').sort().join('')
}

export function letterCounts(letters: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const raw of letters) {
    const letter = raw.toUpperCase()
    counts.set(letter, (counts.get(letter) ?? 0) + 1)
  }
  return counts
}

/**
 * Can `word` be spelled from `pool`, respecting duplicate counts?
 *
 * The duplicate handling is the whole point: LACONIC has two Cs, so CONIC
 * (two Cs) is buildable but a word needing three would not be. A naive
 * `every(letter => pool.includes(letter))` gets this wrong.
 */
export function isSubMultiset(word: string, pool: readonly string[]): boolean {
  if (word.length === 0) return false
  const available = letterCounts(pool)
  for (const raw of word.toUpperCase()) {
    const remaining = available.get(raw)
    if (remaining === undefined || remaining === 0) return false
    available.set(raw, remaining - 1)
  }
  return true
}
