import { expect, test, type Page } from '@playwright/test'

/**
 * PWA installability and offline READINESS, against a production build.
 * The service worker does not exist in dev, so none of this is checkable there.
 *
 * SCOPE, stated honestly: these tests verify the *preconditions* for offline
 * play — the worker registers and takes control, and every asset the game
 * needs is in the cache. They do NOT drive the game with the network cut.
 *
 * That is a tooling limit, not an omission. Playwright offers three ways to
 * simulate offline (`context.setOffline`, `route.abort`, killing the origin)
 * and all three intercept above the service worker, so the worker never gets
 * the chance to serve and the failure says nothing about the app. Asserting
 * cache completeness is the strongest claim that can be made truthfully here.
 *
 * True airplane-mode behaviour is verified by hand on a device: install from
 * Safari, enable airplane mode, open the app, play a level, advance to the
 * next one.
 */

const EXPECTED_LEVELS = 400
/** GitHub Pages serves the app from a subpath, and every cached URL carries it. */
const BASE = '/wordgrid'

/** How many entries are in the caches right now. */
async function cacheSize(page: Page): Promise<number> {
  return page.evaluate(async () => {
    let total = 0
    for (const n of await caches.keys()) total += (await (await caches.open(n)).keys()).length
    return total
  })
}

/**
 * Wait for precaching to actually FINISH — an active worker is not a populated
 * cache; it streams hundreds of entries afterwards.
 *
 * Uses expect.poll rather than page.waitForFunction: an async callback passed
 * to waitForFunction returns a Promise, which is truthy, so the wait resolves
 * instantly and every later assertion runs against an empty cache.
 */
async function precacheReady(page: Page, min = EXPECTED_LEVELS) {
  await expect.poll(() => cacheSize(page), { timeout: 60_000, intervals: [250] }).toBeGreaterThanOrEqual(min)
}

async function cachedUrls(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const out: string[] = []
    for (const n of await caches.keys()) {
      for (const req of await (await caches.open(n)).keys()) {
        out.push(req.url.replace(location.origin, '').split('?')[0])
      }
    }
    return out
  })
}

test('the manifest describes an installable, portrait, standalone app', async ({ page, request }) => {
  await page.goto('/')

  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()

  const manifest = await (await request.get(href!)).json()
  expect(manifest.name).toContain('WordGrid')
  expect(manifest.display).toBe('standalone')
  // The board is a fixed vertical stack; landscape has no room for grid + wheel.
  expect(manifest.orientation).toBe('portrait')
  expect(manifest.start_url).toBeTruthy()

  // Without a maskable icon Android crops the artwork to a circle and slices
  // the letters off.
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)

  // Icon srcs are relative to the manifest, which lives under the base path.
  for (const icon of manifest.icons) {
    const res = await request.get(`${BASE}/` + String(icon.src).replace(/^\//, ''))
    expect(res.status(), icon.src).toBe(200)
  }
  // iOS ignores the manifest icons for home-screen install and uses this one.
  expect((await request.get(`${BASE}/apple-touch-icon.png`)).status()).toBe(200)

  // start_url and scope must sit under the base, or the installed app opens
  // at a path that 404s.
  expect(manifest.start_url).toBe(`${BASE}/`)
  expect(manifest.scope).toBe(`${BASE}/`)
})

test('the service worker registers and takes control of the page', async ({ page }) => {
  await page.goto('/')
  await precacheReady(page)

  const state = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker?.getRegistration()
    return { active: !!reg?.active, controlled: !!navigator.serviceWorker?.controller }
  })
  // Controlling matters as much as active: an activated worker that never
  // claims the page serves nothing until the next visit.
  expect(state.active).toBe(true)
  expect(state.controlled).toBe(true)
})

test('every asset the game needs offline is precached', async ({ page }) => {
  await page.goto('/')
  await precacheReady(page)
  const urls = await cachedUrls(page)

  // The shell.
  expect(urls).toContain(`${BASE}/index.html`)
  expect(urls.some((u) => new RegExp(`^${BASE}/assets/index-.*\\.js$`).test(u)), 'main bundle').toBe(true)
  expect(urls.some((u) => new RegExp(`^${BASE}/assets/index-.*\\.css$`).test(u)), 'stylesheet').toBe(true)
  expect(urls).toContain(`${BASE}/manifest.webmanifest`)

  // The content. Levels are lazy chunks, which is exactly the thing a naive
  // precache misses: the app would install, open offline, and then hang the
  // moment the player pressed Next level.
  const levelChunks = urls.filter((u) => new RegExp(`^${BASE}/assets/level-\\d+-.*\\.js$`).test(u))
  expect(levelChunks.length).toBe(EXPECTED_LEVELS)

  // Spot-check across the range rather than trusting the count alone.
  for (const n of ['001', '002', '200', '400']) {
    expect(
      levelChunks.some((u) => u.includes(`level-${n}-`)),
      `level-${n} chunk missing from precache`,
    ).toBe(true)
  }
})
