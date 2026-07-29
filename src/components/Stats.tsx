import { useGame } from '../game/store'
import styles from './Stats.module.css'

/**
 * Stats, the daily entry point, and the full vocabulary record.
 *
 * The Words Learned list is the reason this screen exists. A level-complete
 * review is a moment; this is the place a player can come back to and see the
 * vocabulary accumulating, which is what turns exposure into retention.
 */
export default function Stats({ onClose }: { onClose: () => void }) {
  const p = useGame((s) => s.progress)
  const streak = useGame((s) => s.streak())
  const dailyDone = useGame((s) => s.dailyDoneToday())
  const startDaily = useGame((s) => s.startDaily)
  const levels = useGame((s) => s.levelIndex)

  const play = () => {
    startDaily()
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose} data-testid="stats">
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Your progress</h2>

        <div className={styles.grid}>
          <div className={styles.stat}>
            <span className={styles.value} data-testid="stat-streak">
              {streak}
            </span>
            <span className={styles.label}>day streak</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.value} data-testid="stat-best">
              {p.bestStreak}
            </span>
            <span className={styles.label}>best streak</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.value} data-testid="stat-levels">
              {p.levelsCompleted}
            </span>
            <span className={styles.label}>levels done</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.valueTeach} data-testid="stat-words">
              {p.learned.length}
            </span>
            <span className={styles.label}>words learned</span>
          </div>
        </div>

        <button
          className={dailyDone ? styles.dailyDone : styles.daily}
          onClick={play}
          disabled={dailyDone}
          data-testid="play-daily"
        >
          {dailyDone ? "✓ Today's puzzle done" : "Play today's puzzle"}
        </button>
        <p className={styles.hint}>
          {dailyDone
            ? `Come back tomorrow to keep the streak. You're on level ${levels + 1}.`
            : 'A new puzzle every day. Same one for everyone.'}
        </p>

        <p className={styles.section}>Words learned</p>
        {p.learned.length === 0 ? (
          <p className={styles.empty}>
            Nothing yet. Solve a mid-frequency word and it lands here.
          </p>
        ) : (
          <ul className={styles.words} data-testid="learned-list">
            {[...p.learned].reverse().map((w) => (
              <li key={w} className={styles.word}>
                {w}
              </li>
            ))}
          </ul>
        )}

        <button className={styles.close} onClick={onClose} data-testid="stats-close">
          Close
        </button>
      </div>
    </div>
  )
}
