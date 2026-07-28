/**
 * Gate every committed level. Exits non-zero on any problem.
 *
 *   npx tsx tools/validate-levels.ts
 *
 * A malformed level should fail the build, not reach a player. Runs the same
 * validateLevel() the engine exposes — so the rules the game enforces at
 * runtime and the rules content is checked against can never drift apart.
 */
import fs from 'node:fs'
import path from 'node:path'
import { isSubMultiset } from '../src/game/anagram'
import { MIN_WORD_LENGTH, validateLevel } from '../src/game/engine'
import type { Level } from '../src/game/types'

const DIR = path.resolve(import.meta.dirname, '..', 'src', 'data', 'levels')
const MAX_ROWS = 8
const MAX_COLS = 8
const MIN_TEACHING = 2

/** Playability checks beyond structural validity. */
function playability(level: Level): string[] {
  const problems: string[] = []
  const all = [...level.placed.map((p) => p.word), ...level.bonus]

  if (level.rows > MAX_ROWS || level.cols > MAX_COLS) {
    problems.push(`grid ${level.rows}x${level.cols} exceeds ${MAX_ROWS}x${MAX_COLS} — needs pinch-zoom on a phone`)
  }

  const teaching = all.filter((w) => level.entries[w]?.band === 'teaching').length
  if (teaching < MIN_TEACHING) {
    problems.push(`only ${teaching} teaching word(s) — a level with nothing to teach is not this game`)
  }

  for (const w of all) {
    const e = level.entries[w]
    if (!e) continue
    if (!e.gloss?.trim()) problems.push(`${w} has an empty gloss — the prompt would be blank`)
    if (!e.definition?.trim()) problems.push(`${w} has an empty definition`)
    if (e.band === 'rare') problems.push(`${w} is rare-band and should never have been included`)
    if (w.length < MIN_WORD_LENGTH) problems.push(`${w} is below the ${MIN_WORD_LENGTH}-letter minimum`)
    if (!isSubMultiset(w, level.pool)) problems.push(`${w} is not spellable from ${level.pool.join('')}`)
  }

  // Every grid word must be reachable from the base word's letters, and the
  // base must use the whole pool — otherwise the wheel shows dead tiles.
  if (level.baseWord.length !== level.pool.length) {
    problems.push('base word does not use every tile in the pool')
  }

  return problems
}

const files = fs.readdirSync(DIR).filter((f) => /^level-\d+\.json$/.test(f)).sort()
if (files.length === 0) {
  console.error('no levels found in src/data/levels/')
  process.exit(1)
}

let failed = 0
for (const file of files) {
  const level: Level = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'))
  const problems = [...validateLevel(level), ...playability(level)]
  if (problems.length > 0) {
    failed++
    console.error(`✗ ${file}`)
    for (const p of problems) console.error(`    ${p}`)
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${files.length} levels failed validation`)
  process.exit(1)
}

console.log(`✓ ${files.length} levels valid`)
