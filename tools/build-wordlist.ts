/**
 * Build data/wordlist.json — the game's vocabulary.
 *
 *   npx tsx tools/build-wordlist.ts
 *
 * Joins two sources:
 *   - WordNet 3.0 (via wordnet-db) for part of speech, definition and examples
 *   - data/zipf.json for frequency, which decides the band
 *
 * Build-time only. Neither wordnet-db nor this script ships to players; the
 * committed JSON is the whole runtime dependency.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { signature } from '../src/game/anagram'
import type { Band } from '../src/game/types'

const require = createRequire(import.meta.url)
const DICT: string = require('wordnet-db').path

const ROOT = path.resolve(import.meta.dirname, '..')
const MIN_LEN = 3
const MAX_LEN = 8

/**
 * Band thresholds on the Zipf scale (log10; 6 ≈ once per thousand words,
 * 3 ≈ once per million).
 *
 * These were calibrated against real data, not assumed. An earlier attempt
 * used rank cutoffs over an OpenSubtitles corpus and failed badly: every word
 * this game exists to teach was absent from it, while ordinary words like
 * `ion` and `coil` landed mid-table. Validated against the hand-authored
 * level-001, these thresholds reproduce all of its classifications.
 */
const COMMON_MIN_ZIPF = 3.6

function bandFor(zipf: number): Band {
  if (zipf >= COMMON_MIN_ZIPF) return 'common'
  return zipf >= 2.0 ? 'teaching' : 'rare'
}

/**
 * Shorter words need to be commoner to earn their place.
 *
 * Measured: every genuinely useful 3-letter word (SUN 4.97, USE 5.81, ELF 3.65)
 * scores at or above ~3.5, while the junk WordNet carries at that length —
 * IVA 2.59, LAV 2.57, LEU 2.46, CUL 2.97, plant genera and abbreviations —
 * sits below. Requiring 3-letter words to reach the common threshold makes
 * them scaffolding by construction, which is right: a three-letter word is
 * rarely worth teaching an adult.
 */
function minZipfFor(length: number): number {
  if (length <= 3) return COMMON_MIN_ZIPF
  if (length === 4) return 2.9
  return 2.0
}

/** Roman numerals parse as words and are not. XLI, LXI and LIV all reached
 *  a generated level before this. */
const ROMAN = /^[IVXLCDM]+$/

/**
 * Content blocklist — deliberately EMPTY.
 *
 * Product decision (2026-07-28): the audience is adults and no word is off
 * limits, so profanity and vulgar terms are allowed through as ordinary
 * vocabulary. The mechanism is kept because it costs nothing and makes the
 * decision reversible: add stems here and inflections expand automatically.
 *
 * If it is ever re-enabled, note that matching must be by stem+suffix and NOT
 * by substring — substring matching takes COCKTAIL, PEACOCK, DOCUMENT and
 * START down with it.
 */
const BLOCKED_STEMS: string[] = []

const BLOCKED = new Set<string>()
for (const stem of BLOCKED_STEMS) {
  BLOCKED.add(stem)
  const doubled = stem + stem[stem.length - 1]
  for (const suffix of ['S', 'ES', 'ED', 'ING', 'ER', 'ERS', 'Y']) {
    BLOCKED.add(stem + suffix)
    BLOCKED.add(doubled + suffix)
    // Drop-the-e, but only before a vowel-initial suffix — the actual English
    // rule. Applying it to -S as well would turn RAPE into RAP and wrongly
    // block RAPS.
    if (stem.endsWith('E') && /^[AEIOU]/.test(suffix)) {
      BLOCKED.add(stem.slice(0, -1) + suffix)
    }
  }
}

const POS_LABEL: Record<string, string> = {
  n: 'n.',
  v: 'v.',
  a: 'adj.',
  s: 'adj.',
  r: 'adv.',
}

/**
 * WordNet labels offensive senses in the gloss itself. Filtering on its own
 * markers beats a hand-written word list: it is maintained by lexicographers
 * and it distinguishes a slur from a swear word, which a name-based list
 * cannot.
 *
 * Deliberately excludes bare "pejorative" — SODDING is glossed "(often
 * pejorative) intensifier", which is profanity, and profanity is allowed.
 */
const SLUR_MARKER = /\([^)]*\b(?:slur|disparaging|derogatory|contemptuous)\b[^)]*\)/i

interface Sense {
  pos: string
  offset: string
  /** How many times this lemma+pos was tagged in the sense-annotated corpus.
   *  Higher means the word is genuinely used that way most often. */
  tagged: number
}

/** WordNet files carry a licence header on lines starting with two spaces. */
function dataLines(file: string): string[] {
  return fs
    .readFileSync(path.join(DICT, file), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('  '))
}

/**
 * index.<pos>: lemma pos synset_cnt p_cnt [ptrs...] sense_cnt tagsense_cnt offset...
 * The FIRST offset is the most common sense, which is the one worth teaching.
 */
function readIndex(): Map<string, Sense[]> {
  const senses = new Map<string, Sense[]>()

  for (const pos of ['noun', 'verb', 'adj', 'adv']) {
    for (const line of dataLines(`index.${pos}`)) {
      const f = line.trim().split(/\s+/)
      const [lemma, posChar] = f
      if (lemma.includes('_') || !/^[a-z]+$/.test(lemma)) continue
      if (lemma.length < MIN_LEN || lemma.length > MAX_LEN) continue

      const pCnt = Number(f[3])
      // Skip the pointer symbols to reach sense_cnt / tagsense_cnt / offsets.
      const after = 4 + pCnt
      const senseCnt = Number(f[after])
      const tagged = Number(f[after + 1])
      const offsets = f.slice(after + 2, after + 2 + (Number.isFinite(senseCnt) ? senseCnt : 1))
      if (offsets.length === 0) continue

      // Every sense, in WordNet's own order (most common first). Keeping the
      // alternatives lets a word fall back when its top sense is unusable.
      const key = lemma.toUpperCase()
      const list = senses.get(key) ?? []
      for (const offset of offsets) {
        list.push({ pos: posChar, offset, tagged: Number.isFinite(tagged) ? tagged : 0 })
      }
      senses.set(key, list)
    }
  }
  return senses
}

/**
 * data.<pos>: offset lex_filenum ss_type w_cnt word lex_id [word lex_id...] ... | gloss
 *
 * Unlike index.*, the data files preserve original CASING — `Augusta` and
 * `Tagus` are stored capitalised, acronyms in caps. That is the only reliable
 * signal for filtering proper nouns and abbreviations out, and skipping it
 * produced levels built on AUGUSTA with GSA/TSA/USA as bonus words.
 */
function readGlosses(): Map<string, { definition: string; example?: string; surfaces: string[] }> {
  const glosses = new Map<string, { definition: string; example?: string; surfaces: string[] }>()

  for (const pos of ['noun', 'verb', 'adj', 'adv']) {
    for (const line of dataLines(`data.${pos}`)) {
      const bar = line.indexOf('|')
      if (bar === -1) continue
      const offset = line.slice(0, 8)
      const raw = line.slice(bar + 1).trim()

      // Surface forms: w_cnt is 2-digit hex, then (word, lex_id) pairs.
      const head = line.slice(0, bar).trim().split(/\s+/)
      const wCnt = parseInt(head[3], 16)
      const surfaces: string[] = []
      for (let i = 0; i < wCnt; i++) {
        const w = head[4 + i * 2]
        if (w) surfaces.push(w.replace(/\([a-z]+\)$/, '')) // drop adjective markers like able(p)
      }

      // Split on semicolons, but quoted examples may themselves contain them.
      const parts = raw.split(/;\s*/)
      const defParts: string[] = []
      let example: string | undefined
      for (const part of parts) {
        if (part.startsWith('"')) {
          if (!example) example = part.replace(/^"|"$/g, '').replace(/"$/, '').trim()
        } else if (!example) {
          defParts.push(part)
        }
      }

      const definition = defParts.join('; ').trim()
      if (definition) glosses.set(`${pos}:${offset}`, { definition, example, surfaces })
    }
  }
  return glosses
}

/** The prompt needs a short clue, not a paragraph. */
function toGloss(definition: string): string {
  let g = definition
    .replace(/\([^)]*\)/g, '') // strip parentheticals like "(usually followed by `to')"
    .replace(/\s+/g, ' ')
    .trim()
  // First clause only — enough to identify the word, short enough for the band.
  const cut = g.split(/[;:]/)[0].trim()
  if (cut.length >= 12) g = cut
  return g.length > 90 ? g.slice(0, 87).replace(/\s+\S*$/, '') + '…' : g
}

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?…]$/.test(s) ? '' : '.')
}

// ---------------------------------------------------------------------------

const zipf: Record<string, number> = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'zipf.json'), 'utf8'),
)

const senses = readIndex()
const glosses = readGlosses()

const out: Record<string, unknown> = {}
const counts = {
  common: 0,
  teaching: 0,
  skippedNoZipf: 0,
  skippedNoGloss: 0,
  skippedRare: 0,
  skippedProperOrAcronym: 0,
  skippedBlocked: 0,
  skippedTooRareForLength: 0,
  skippedSlurOnly: 0,
}

for (const [word, list] of senses) {
  if (BLOCKED.has(word) || ROMAN.test(word)) {
    counts.skippedBlocked++
    continue
  }

  const z = zipf[word]
  if (z === undefined) {
    counts.skippedNoZipf++
    continue
  }
  if (z < minZipfFor(word.length)) {
    counts.skippedTooRareForLength++
    continue
  }
  const band = bandFor(z)
  if (band === 'rare') {
    counts.skippedRare++
    continue
  }

  // Walk senses most-common-first and take the first usable one. Falling back
  // rather than dropping the word is what keeps TACO (the food) and CHINK (a
  // narrow crack) playable even though WordNet ranks their slur senses first.
  const ordered = [...list].sort((a, b) => b.tagged - a.tagged)
  let best: Sense | undefined
  let entry: { definition: string; example?: string; surfaces: string[] } | undefined
  let sawSlur = false
  let sawCapitalised = false

  for (const sense of ordered) {
    const dir = sense.pos === 'n' ? 'noun' : sense.pos === 'v' ? 'verb' : sense.pos === 'r' ? 'adv' : 'adj'
    const candidate = glosses.get(`${dir}:${sense.offset}`)
    if (!candidate) continue

    // The lemma must appear in its own synset as pure lowercase. Proper nouns
    // (Augusta, Tagus) and acronyms (GSA, TSA) carry capitals.
    const surface = candidate.surfaces.find((s) => s.toUpperCase() === word)
    if (!surface || surface !== surface.toLowerCase()) {
      sawCapitalised = true
      continue
    }
    if (SLUR_MARKER.test(candidate.definition)) {
      sawSlur = true
      continue
    }

    best = sense
    entry = candidate
    break
  }

  if (!best || !entry) {
    if (sawSlur) counts.skippedSlurOnly++
    else if (sawCapitalised) counts.skippedProperOrAcronym++
    else counts.skippedNoGloss++
    continue
  }

  out[word] = {
    word,
    signature: signature(word),
    pos: POS_LABEL[best.pos] ?? '',
    gloss: toGloss(entry.definition),
    definition: sentenceCase(entry.definition.replace(/\s+/g, ' ').trim()),
    ...(entry.example ? { example: sentenceCase(entry.example) } : {}),
    zipf: z,
    band,
    tier: 'general',
  }
  counts[band]++
}

const dest = path.join(ROOT, 'data', 'wordlist.json')
fs.writeFileSync(dest, JSON.stringify(out, null, 0))

console.log(`wrote data/wordlist.json`)
console.log(`  ${Object.keys(out).length.toLocaleString()} words (${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)} MB)`)
console.log(`    common:   ${counts.common.toLocaleString()}`)
console.log(`    teaching: ${counts.teaching.toLocaleString()}`)
console.log(`  skipped — no frequency: ${counts.skippedNoZipf.toLocaleString()}`)
console.log(`            proper noun/acronym: ${counts.skippedProperOrAcronym.toLocaleString()}`)
console.log(`            too rare for length: ${counts.skippedTooRareForLength.toLocaleString()}`)
console.log(`            blocked/roman:       ${counts.skippedBlocked.toLocaleString()}`)
console.log(`            slur-only senses:    ${counts.skippedSlurOnly.toLocaleString()}`)
