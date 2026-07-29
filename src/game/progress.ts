/**
 * Progression, streaks and the daily level.
 *
 * Pure like engine.ts — dates come in as arguments, never read from the clock
 * inside. That is what makes "does the streak survive midnight?" a unit test
 * rather than something you find out from a player.
 */

export interface Progress {
  /** How far up the ladder the player has climbed. */
  levelIndex: number
  /** Teaching-band words learned across every session. */
  learned: string[]
  /** Local day (YYYY-MM-DD) a level was last completed, or null. */
  lastPlayedDay: string | null
  currentStreak: number
  bestStreak: number
  levelsCompleted: number
  /** Local days on which the daily level was finished. */
  dailyDone: string[]
}

export const EMPTY_PROGRESS: Progress = {
  levelIndex: 0,
  learned: [],
  lastPlayedDay: null,
  currentStreak: 0,
  bestStreak: 0,
  levelsCompleted: 0,
  dailyDone: [],
}

/**
 * LOCAL calendar day, not UTC.
 *
 * Using UTC would roll the streak over at 7pm for a player in California —
 * they'd finish a level on Monday evening and be told it counted for Tuesday.
 */
export function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Days since the epoch for a YYYY-MM-DD key. Parsed as UTC noon so daylight
 *  saving can never shift a date across a boundary. */
function epochDay(day: string): number {
  return Math.floor(Date.parse(`${day}T12:00:00Z`) / 86_400_000)
}

export function daysBetween(from: string, to: string): number {
  return epochDay(to) - epochDay(from)
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/**
 * A stride coprime with the level count, so stepping by it visits every level
 * exactly once before repeating.
 *
 * Hashing the date instead would collide by the birthday problem — with 400
 * levels you would see a repeat within about a month. A coprime stride gives a
 * full permutation: no repeat until the whole catalogue is exhausted.
 */
function coprimeStride(count: number): number {
  for (const candidate of [9973, 997, 137, 31, 7]) {
    if (candidate < count && gcd(candidate, count) === 1) return candidate
  }
  return 1
}

/** Which level is the daily for a given day. Deterministic: every player on
 *  the same date gets the same puzzle. */
export function dailyLevelIndex(day: string, levelCount: number): number {
  if (levelCount <= 0) return 0
  const stride = coprimeStride(levelCount)
  return (((epochDay(day) * stride) % levelCount) + levelCount) % levelCount
}

export function isDailyDone(progress: Progress, day: string): boolean {
  return progress.dailyDone.includes(day)
}

/**
 * The streak as it stands *today* — which is not the same as the stored value.
 *
 * A stored streak of 5 whose last play was a week ago is not a 5-day streak;
 * it is a dead one. Displaying the raw number would tell players they have a
 * streak they have already lost.
 */
export function currentStreak(progress: Progress, today: string): number {
  if (!progress.lastPlayedDay) return 0
  const gap = daysBetween(progress.lastPlayedDay, today)
  return gap <= 1 ? progress.currentStreak : 0
}

/** Record a completed level. Idempotent within a day for streak purposes. */
export function recordCompletion(
  progress: Progress,
  day: string,
  opts: { isDaily?: boolean } = {},
): Progress {
  const next: Progress = {
    ...progress,
    levelsCompleted: progress.levelsCompleted + 1,
    learned: [...progress.learned],
    dailyDone: [...progress.dailyDone],
  }

  if (opts.isDaily && !next.dailyDone.includes(day)) {
    next.dailyDone = [...next.dailyDone, day]
  }

  if (progress.lastPlayedDay === day) {
    // Already counted today — more levels do not extend a streak further.
    return next
  }

  const gap = progress.lastPlayedDay ? daysBetween(progress.lastPlayedDay, day) : Infinity
  next.currentStreak = gap === 1 ? progress.currentStreak + 1 : 1
  next.lastPlayedDay = day
  next.bestStreak = Math.max(progress.bestStreak, next.currentStreak)
  return next
}

/** Merge newly learned words, preserving discovery order and deduping. */
export function addLearned(progress: Progress, words: readonly string[]): Progress {
  const merged = [...progress.learned]
  for (const w of words) if (!merged.includes(w)) merged.push(w)
  return merged.length === progress.learned.length ? progress : { ...progress, learned: merged }
}
