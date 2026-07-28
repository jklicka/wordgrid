import { expect, test, type Page } from '@playwright/test'

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
  // First square in DOM order is the top of LOCI, the level's other
  // teaching word.
  await page.getByTestId('cell-empty').first().click()

  const prompt = page.getByTestId('prompt-panel')
  await expect(prompt).toBeVisible()
  await expect(page.getByTestId('prompt-gloss')).toContainText('plural of locus')
  await expect(prompt).toContainText('4 letters')
})

test('each square prompts for its own word', async ({ page }) => {
  // Squares 3..9 are the LACONIC row; any of them should prompt for it.
  await page.getByTestId('cell-empty').nth(2).click()
  await expect(page.getByTestId('prompt-gloss')).toContainText('using very few words')
  await expect(page.getByTestId('prompt-panel')).toContainText('7 letters')
})

test('solving a teaching word reveals the full entry and fills the grid', async ({ page }) => {
  await play(page, 'LACONIC')

  const panel = page.getByTestId('definition-panel')
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('definition-word')).toHaveText('LACONIC')
  await expect(panel).toContainText('adj.')
  await expect(page.getByTestId('definition-text')).toContainText('Using very few words')
  await expect(panel).toContainText('laconic nod')

  await expect(page.getByTestId('progress')).toHaveText('1/5 words')
  await expect(page.getByTestId('learned-count')).toContainText('1 learned')
})

// The band rule. If common words fired the panel, players would learn to
// ignore it and the vocabulary mechanic would be dead.
test('a common word fills the grid without teaching', async ({ page }) => {
  await play(page, 'LION')

  await expect(page.getByTestId('silent-ack')).toHaveText('✓ LION')
  await expect(page.getByTestId('definition-panel')).toHaveCount(0)
  await expect(page.getByTestId('progress')).toHaveText('1/5 words')
  await expect(page.getByTestId('learned-count')).toContainText('0 learned')
})

test('a bonus word teaches without filling the grid', async ({ page }) => {
  await play(page, 'CONICAL')

  const panel = page.getByTestId('definition-panel')
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('definition-word')).toHaveText('CONICAL')
  await expect(panel).toContainText('bonus')

  await expect(page.getByTestId('progress')).toHaveText('0/5 words')
  await expect(page.getByTestId('bonus-count')).toHaveText('+1 bonus')
  await expect(page.getByTestId('learned-count')).toContainText('1 learned')
})

test('an unrecognized word is rejected without side effects', async ({ page }) => {
  await play(page, 'CLON')

  await expect(page.getByTestId('reject')).toContainText('Not a word')
  await expect(page.getByTestId('progress')).toHaveText('0/5 words')
})

test('the panel replaces the prompt without moving the wheel', async ({ page }) => {
  // A wheel that shifts under the thumb when a panel appears causes mistaps
  // and reads as broken, so its position must be invariant.
  const wheel = page.getByTestId('letter-pool')
  const before = await wheel.boundingBox()

  await page.getByTestId('cell-empty').first().click()
  await expect(page.getByTestId('prompt-panel')).toBeVisible()
  expect(await wheel.boundingBox()).toEqual(before)

  await play(page, 'LACONIC')
  await expect(page.getByTestId('definition-panel')).toBeVisible()
  expect(await wheel.boundingBox()).toEqual(before)
})

test('completing the level reviews every word learned and nothing else', async ({ page }) => {
  await play(page, 'CONICAL') // bonus, teaching
  for (const word of ['LACONIC', 'LOCI', 'LION', 'ION', 'CAN']) {
    await play(page, word)
  }

  const learned = page.getByTestId('words-learned')
  await expect(page.getByTestId('level-complete')).toBeVisible()

  // Discovery order, teaching band only.
  await expect(learned.locator('li')).toHaveCount(3)
  await expect(learned).toContainText('CONICAL')
  await expect(learned).toContainText('LACONIC')
  await expect(learned).toContainText('LOCI')

  // The scaffolding words must not appear — they filled the grid, not the mind.
  await expect(learned).not.toContainText('LION')
  await expect(learned).not.toContainText('ION')
  await expect(learned).not.toContainText('CAN')
})
