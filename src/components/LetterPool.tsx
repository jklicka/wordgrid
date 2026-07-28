import { useGame } from '../game/store'
import styles from './Pool.module.css'

/**
 * The letter wheel. Tap to select — ~80% of the Wordscapes feel for ~10% of
 * the code, and it behaves identically under mouse and touch, so the desktop
 * dev loop matches the phone. Swipe-to-connect replaces this in Phase 6 and
 * will touch no other file, because all the logic lives in the pure engine.
 */
export default function LetterPool() {
  const game = useGame((s) => s.game)
  const selectLetter = useGame((s) => s.selectLetter)

  const n = game.level.pool.length

  return (
    <div className={styles.wheel} data-testid="letter-pool">
      {game.level.pool.map((letter, i) => {
        // Lay the tiles on a circle, first tile at twelve o'clock.
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2
        const used = game.selection.includes(i)
        return (
          <button
            key={i}
            className={used ? styles.tileUsed : styles.tile}
            style={{
              left: `${50 + 38 * Math.cos(angle)}%`,
              top: `${50 + 38 * Math.sin(angle)}%`,
            }}
            onClick={() => selectLetter(i)}
            data-testid={`pool-${i}`}
            data-letter={letter}
            aria-label={`letter ${letter}`}
            aria-pressed={used}
          >
            {letter}
          </button>
        )
      })}
    </div>
  )
}
