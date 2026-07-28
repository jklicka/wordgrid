import { learnedEntries } from '../game/engine'
import { useGame } from '../game/store'
import styles from './Complete.module.css'

/**
 * The retention screen.
 *
 * Showing a definition once teaches nothing — this review is where the
 * vocabulary actually sticks, and it is what separates the product from a
 * crossword with a footnote.
 */
export default function LevelComplete() {
  const game = useGame((s) => s.game)
  const lifetime = useGame((s) => s.lifetimeLearned)
  const restartLevel = useGame((s) => s.restartLevel)
  const nextLevel = useGame((s) => s.nextLevel)
  const hasNext = useGame((s) => s.hasNextLevel())

  const learned = learnedEntries(game)

  return (
    <div className={styles.overlay} data-testid="level-complete">
      <div className={styles.card}>
        <p className={styles.kicker}>Level complete</p>
        <h1 className={styles.title}>{game.level.baseWord}</h1>

        <p className={styles.section}>Words learned</p>
        <ul className={styles.list} data-testid="words-learned">
          {learned.map((entry) => (
            <li key={entry.word} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.itemWord}>{entry.word}</span>
                <span className={styles.itemPos}>{entry.pos}</span>
              </div>
              <p className={styles.itemDef}>{entry.definition}</p>
            </li>
          ))}
        </ul>

        <p className={styles.lifetime} data-testid="lifetime-count">
          {lifetime.length} {lifetime.length === 1 ? 'word' : 'words'} learned all-time
        </p>

        {hasNext ? (
          <button className={styles.again} onClick={nextLevel} data-testid="next-level">
            Next level
          </button>
        ) : (
          <p className={styles.lifetime}>That's every level for now — more coming.</p>
        )}
        <button className={styles.replay} onClick={restartLevel} data-testid="replay-level">
          Replay this level
        </button>
      </div>
    </div>
  )
}
