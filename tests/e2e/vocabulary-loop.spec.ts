import { expect, test, type Page } from '@playwright/test'
import level from '../../src/data/levels/level-001.json' with { type: 'json' }

/**
 * Subjects are derived from the level data rather than hardcoded, so
 * regenerating content cannot silently invalidate these tests. (The
 * teaching-band BONUS path is not exercisable here — level-001's bonus words
 * are all common — and is covered by the engine unit tests instead.)
 */
const entries = level.entries as Record<string, { band: string; gloss: string; pos: string }>
const gridWords = level.placed.map((p) => p.word)
const TEACHING = gridWords.find((w) => entries[w].band === 'teaching')!
const COMMON = gridWords.find((w) => entries[w].band === 'common')!
const BONUS = level.bonus[0]

/** Tap out a word on the wheel, consuming each tile at most once. */
async function tapWord(page: Page, word: string) {
  const used = new Set<number>()
  const tiles = page.getByTestId(/^pool-/)
  const count = await tiles.count()

  for (const letter of word.toUpperCase()) {
    let tapped = false
    for (let i = 0; i < count; i++) {
      if (used.has(i)) continue
      const tile = tiles.nth(i)
      if ((await tile.getAttribute('data-letter')) === letter) {
        await tile.click()
        used.add(i)
        tapped = true
        break
      }
    }
    if (!tapped) throw new Error(`no free tile for "${letter}" in "${word}"`)
  }
}

async function play(page: Page, word: string) {
  await tapWord(page, word)
  await page.getByTestId('submit').click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('an unsolved square offers its definition as the prompt', async ({ page }) => {
  await page.getByTestId('cell-empty').first().click()

  const prompt = page.getByTestId('prompt-panel')
  await expect(prompt).toBeVisible()
  await expect(page.getByTestId('prompt-gloss')).not.toBeEmpty()
  await expect(prompt).toContainText('letters')
})

test('solving a teaching word reveals the full entry and fills the grid', async ({ page }) => {
  await play(page, TEACHING)

  const panel = page.getByTestId('definition-panel')
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('definition-word')).toHaveText(TEACHING)
  await expect(panel).toContainText(entries[TEACHING].pos)
  await expect(page.getByTestId('definition-text')).not.toBeEmpty()

  await expect(page.getByTestId('progress')).toContainText(`1/${gridWords.length}`)
  await expect(page.getByTestId('learned-count')).toContainText('1 learned')
})

// The band rule. If common words fired the panel, players would learn to
// ignore it and the vocabulary mechanic would be dead.
test('a common word fills the grid without teaching', async ({ page }) => {
  await play(page, COMMON)

  await expect(page.getByTestId('silent-ack')).toHaveText(`✓ ${COMMON}`)
  await expect(page.getByTestId('definition-panel')).toHaveCount(0)
  await expect(page.getByTestId('progress')).toContainText(`1/${gridWords.length}`)
  await expect(page.getByTestId('learned-count')).toContainText('0 learned')
})

test('a bonus word counts without filling the grid', async ({ page }) => {
  await play(page, BONUS)

  await expect(page.getByTestId('bonus-count')).toHaveText('+1 bonus')
  await expect(page.getByTestId('progress')).toContainText(`0/${gridWords.length}`)
})

/** Spellable from the pool but recognised by nothing. Derived rather than
 *  hardcoded — the first guess, pool.slice(0,3), happened to spell BAN, which
 *  is a real bonus word. */
function unrecognizedWord(): string {
  const p = level.pool
  for (let a = 0; a < p.length; a++) {
    for (let b = 0; b < p.length; b++) {
      for (let c = 0; c < p.length; c++) {
        if (a === b || b === c || a === c) continue
        const s = p[a] + p[b] + p[c]
        if (!(s in entries)) return s
      }
    }
  }
  throw new Error('every 3-letter arrangement of this pool is a real word')
}

test('an unrecognized word is rejected without side effects', async ({ page }) => {
  await play(page, unrecognizedWord())

  await expect(page.getByTestId('reject')).toBeVisible()
  await expect(page.getByTestId('progress')).toContainText(`0/${gridWords.length}`)
})

test('the panel replaces the prompt without moving the wheel', async ({ page }) => {
  // A wheel that shifts under the thumb when a panel appears causes mistaps
  // and reads as broken, so its position must be invariant.
  const wheel = page.getByTestId('letter-pool')
  const before = await wheel.boundingBox()

  await page.getByTestId('cell-empty').first().click()
  await expect(page.getByTestId('prompt-panel')).toBeVisible()
  expect(await wheel.boundingBox()).toEqual(before)

  await play(page, TEACHING)
  await expect(page.getByTestId('definition-panel')).toBeVisible()
  expect(await wheel.boundingBox()).toEqual(before)
})

// A real iPhone 13 has only ~625px of usable height once browser chrome is
// accounted for. Sizing the grid by width alone overflowed it under the header
// and behind the definition panel — invisible at a bare 390x844 preview.
test('the whole board fits the viewport with nothing overlapping', async ({ page }) => {
  const viewport = page.viewportSize()!
  const grid = page.getByTestId('grid')
  const wheel = page.getByTestId('letter-pool')

  const fits = async (label: string) => {
    const g = (await grid.boundingBox())!
    const w = (await wheel.boundingBox())!
    expect(g.y, `${label}: grid clipped at top`).toBeGreaterThanOrEqual(0)
    expect(g.y + g.height, `${label}: grid overlaps the wheel`).toBeLessThanOrEqual(w.y + 1)
    expect(w.y + w.height, `${label}: wheel past the bottom`).toBeLessThanOrEqual(viewport.height + 1)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(0)
  }

  await fits('idle')

  await page.getByTestId('cell-empty').first().click()
  await expect(page.getByTestId('prompt-panel')).toBeVisible()
  await fits('prompt showing')

  await play(page, TEACHING)
  await expect(page.getByTestId('definition-panel')).toBeVisible()
  await fits('definition showing')
})

test('completing the level reviews every word learned and nothing else', async ({ page }) => {
  for (const word of gridWords) await play(page, word)

  const learned = page.getByTestId('words-learned')
  await expect(page.getByTestId('level-complete')).toBeVisible()

  const teaching = gridWords.filter((w) => entries[w].band === 'teaching')
  const common = gridWords.filter((w) => entries[w].band === 'common')

  await expect(learned.locator('li')).toHaveCount(teaching.length)
  for (const w of teaching) await expect(learned).toContainText(w)
  // Scaffolding words filled the grid, not the mind.
  for (const w of common) await expect(learned).not.toContainText(new RegExp(`\\b${w}\\b`))
})

test('finishing a level advances to the next one', async ({ page }) => {
  await expect(page.getByTestId('progress')).toContainText('L1')

  for (const word of gridWords) await play(page, word)
  await page.getByTestId('next-level').click()

  await expect(page.getByTestId('level-complete')).toHaveCount(0)
  await expect(page.getByTestId('progress')).toContainText('L2')
  await expect(page.getByTestId('progress')).toContainText('0/')
})

// Not cosmetic: WordNet's licence requires its copyright notice to appear on
// all copies of the data, and definitions ship inside every level file.
test('the WordNet notice is reachable in-app', async ({ page }) => {
  await page.getByTestId('credits-open').click()

  const credits = page.getByTestId('credits')
  await expect(credits).toBeVisible()
  await expect(credits).toContainText('WordNet 3.0')
  await expect(credits).toContainText('Copyright 2006 by Princeton University')

  await page.getByTestId('credits-close').click()
  await expect(credits).toHaveCount(0)
})

test('finishing a level starts a streak and records stats', async ({ page }) => {
  await page.getByTestId('progress').click()
  await expect(page.getByTestId('stat-levels')).toHaveText('0')
  await expect(page.getByTestId('stat-streak')).toHaveText('0')
  await page.getByTestId('stats-close').click()

  for (const word of gridWords) await play(page, word)
  await expect(page.getByTestId('complete-streak')).toContainText('1-day streak')

  await page.getByTestId('next-level').click()
  await page.getByTestId('progress').click()
  await expect(page.getByTestId('stat-levels')).toHaveText('1')
  await expect(page.getByTestId('stat-streak')).toHaveText('1')
  await expect(page.getByTestId('stat-best')).toHaveText('1')

  // Teaching words reach the permanent record; scaffolding does not.
  const teaching = gridWords.filter((w) => entries[w].band === 'teaching')
  await expect(page.getByTestId('stat-words')).toHaveText(String(teaching.length))
  for (const w of teaching) await expect(page.getByTestId('learned-list')).toContainText(w)
})

test('the daily puzzle launches from the stats screen', async ({ page }) => {
  await page.getByTestId('progress').click()
  await expect(page.getByTestId('play-daily')).toBeEnabled()
  await page.getByTestId('play-daily').click()

  // Daily is a different level from the ladder, and the header says so.
  await expect(page.getByTestId('progress')).toContainText('Daily')
  await expect(page.getByTestId('letter-pool')).toBeVisible()
  await expect(page.getByTestId('grid')).toBeVisible()
  await expect(page.getByTestId('progress')).toContainText('0/')

  // (That completing the daily marks it done, and that it cannot be replayed
  // for a second streak credit, is covered by the progress unit tests — the
  // daily's words are not knowable from the DOM.)
})

test('selecting a word outlines it on the board and keeps it outlined while typing', async ({
  page,
}) => {
  const outlined = page.locator('[data-selected="true"]')
  await expect(outlined).toHaveCount(0)

  await page.getByTestId('cell-empty').first().click()

  // Every square of the selected word, crossings included.
  const selectedWord = gridWords.find((w) => entries[w].band === 'teaching')!
  await expect(outlined.first()).toBeVisible()
  const count = await outlined.count()
  expect(count).toBeGreaterThan(0)

  // Gold outline — the same colour that FILLS a solved square (#ffc44d).
  // Polled, not read once: the outline transitions in, and sampling mid-flight
  // returns an interpolated colour.
  await expect
    .poll(() => outlined.first().evaluate((el) => getComputedStyle(el).boxShadow))
    .toContain('rgb(255, 196, 77)')

  // The point of the whole change: the prompt panel is retired by the first
  // keypress, but the outline must not be.
  await tapWord(page, selectedWord.slice(0, 2))
  await expect(page.getByTestId('prompt-panel')).toHaveCount(0)
  await expect(outlined).toHaveCount(count)

  // Submitting ends the attempt, so the outline goes with it.
  await page.getByTestId('submit').click()
  await expect(outlined).toHaveCount(0)
})
