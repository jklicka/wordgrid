import { describe, expect, it } from 'vitest'
import {
  addLearned,
  currentStreak,
  dailyLevelIndex,
  dayKey,
  daysBetween,
  EMPTY_PROGRESS,
  isDailyDone,
  recordCompletion,
  type Progress,
} from '../../src/game/progress'

const at = (p: Partial<Progress> = {}): Progress => ({ ...EMPTY_PROGRESS, ...p })

describe('dayKey', () => {
  // The whole reason dayKey exists: toISOString() would report the NEXT day
  // for a US evening, silently shifting the streak boundary.
  it('uses the local calendar day, not UTC', () => {
    const evening = new Date(2026, 6, 28, 21, 30) // 28 Jul, 9:30pm local
    expect(dayKey(evening)).toBe('2026-07-28')
  })

  it('zero-pads month and day', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('daysBetween', () => {
  it('counts consecutive days as one', () => {
    expect(daysBetween('2026-07-27', '2026-07-28')).toBe(1)
  })

  it('handles month and year boundaries', () => {
    expect(daysBetween('2026-07-31', '2026-08-01')).toBe(1)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
  })

  it('spans a daylight-saving transition without drifting', () => {
    // US DST ends 1 Nov 2026; parsing at UTC noon keeps this exact.
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
  })

  it('is negative going backwards', () => {
    expect(daysBetween('2026-07-28', '2026-07-27')).toBe(-1)
  })
})

describe('dailyLevelIndex', () => {
  it('is deterministic for a given day', () => {
    expect(dailyLevelIndex('2026-07-28', 400)).toBe(dailyLevelIndex('2026-07-28', 400))
  })

  it('stays in range', () => {
    for (const day of ['2026-01-01', '2026-07-28', '2027-12-31']) {
      const i = dailyLevelIndex(day, 400)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(400)
    }
  })

  it('gives different days different levels', () => {
    expect(dailyLevelIndex('2026-07-28', 400)).not.toBe(dailyLevelIndex('2026-07-29', 400))
  })

  // The point of a coprime stride: a hash would repeat within weeks.
  it('visits every level before repeating any', () => {
    const count = 400
    const seen = new Set<number>()
    const start = Date.parse('2026-01-01T12:00:00Z')
    for (let d = 0; d < count; d++) {
      const day = new Date(start + d * 86_400_000).toISOString().slice(0, 10)
      seen.add(dailyLevelIndex(day, count))
    }
    expect(seen.size).toBe(count)
  })

  it('survives a level count that shares factors with the stride', () => {
    const count = 7 // divides one of the candidate strides
    const seen = new Set<number>()
    const start = Date.parse('2026-01-01T12:00:00Z')
    for (let d = 0; d < count; d++) {
      seen.add(dailyLevelIndex(new Date(start + d * 86_400_000).toISOString().slice(0, 10), count))
    }
    expect(seen.size).toBe(count)
  })

  it('does not divide by zero on an empty catalogue', () => {
    expect(dailyLevelIndex('2026-07-28', 0)).toBe(0)
  })
})

describe('recordCompletion', () => {
  it('starts a streak at one', () => {
    const p = recordCompletion(at(), '2026-07-28')
    expect(p.currentStreak).toBe(1)
    expect(p.bestStreak).toBe(1)
    expect(p.levelsCompleted).toBe(1)
  })

  it('extends a streak on consecutive days', () => {
    let p = recordCompletion(at(), '2026-07-27')
    p = recordCompletion(p, '2026-07-28')
    expect(p.currentStreak).toBe(2)
  })

  it('resets after a missed day', () => {
    let p = recordCompletion(at(), '2026-07-25')
    p = recordCompletion(p, '2026-07-28')
    expect(p.currentStreak).toBe(1)
  })

  // Playing five levels in one sitting is one day of engagement, not five.
  it('does not inflate the streak within a single day', () => {
    let p = recordCompletion(at(), '2026-07-28')
    p = recordCompletion(p, '2026-07-28')
    p = recordCompletion(p, '2026-07-28')
    expect(p.currentStreak).toBe(1)
    expect(p.levelsCompleted).toBe(3)
  })

  it('remembers the best streak after a reset', () => {
    let p = at()
    for (const d of ['2026-07-01', '2026-07-02', '2026-07-03']) p = recordCompletion(p, d)
    expect(p.bestStreak).toBe(3)
    p = recordCompletion(p, '2026-07-20')
    expect(p.currentStreak).toBe(1)
    expect(p.bestStreak).toBe(3)
  })

  it('records the daily only when told, and only once', () => {
    let p = recordCompletion(at(), '2026-07-28')
    expect(isDailyDone(p, '2026-07-28')).toBe(false)
    p = recordCompletion(p, '2026-07-28', { isDaily: true })
    p = recordCompletion(p, '2026-07-28', { isDaily: true })
    expect(p.dailyDone).toEqual(['2026-07-28'])
  })

  it('carries a streak across a month boundary', () => {
    let p = recordCompletion(at(), '2026-07-31')
    p = recordCompletion(p, '2026-08-01')
    expect(p.currentStreak).toBe(2)
  })
})

describe('currentStreak', () => {
  it('counts today', () => {
    expect(currentStreak(at({ lastPlayedDay: '2026-07-28', currentStreak: 4 }), '2026-07-28')).toBe(4)
  })

  // Still alive: you have until end of today to keep it.
  it('counts yesterday', () => {
    expect(currentStreak(at({ lastPlayedDay: '2026-07-27', currentStreak: 4 }), '2026-07-28')).toBe(4)
  })

  // The stored number would say 4. Showing that would tell players they have
  // a streak they already lost.
  it('reports zero once the streak is broken', () => {
    expect(currentStreak(at({ lastPlayedDay: '2026-07-20', currentStreak: 4 }), '2026-07-28')).toBe(0)
  })

  it('is zero with no history', () => {
    expect(currentStreak(at(), '2026-07-28')).toBe(0)
  })
})

describe('addLearned', () => {
  it('appends in discovery order', () => {
    const p = addLearned(at(), ['LACONIC', 'ERSATZ'])
    expect(p.learned).toEqual(['LACONIC', 'ERSATZ'])
  })

  it('dedupes against what is already known', () => {
    const p = addLearned(addLearned(at(), ['LACONIC']), ['LACONIC', 'ERSATZ'])
    expect(p.learned).toEqual(['LACONIC', 'ERSATZ'])
  })

  it('returns the same object when nothing is new', () => {
    const p = addLearned(at(), ['LACONIC'])
    expect(addLearned(p, ['LACONIC'])).toBe(p)
  })
})
