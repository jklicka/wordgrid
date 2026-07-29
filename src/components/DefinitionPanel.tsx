import { useActiveGame } from '../game/store'
import styles from './Panels.module.css'

const REJECTION: Record<string, string> = {
  invalid: 'Not a word in this puzzle',
  tooShort: 'Words must be at least 3 letters',
  already: 'Already found',
}

/**
 * Definition-as-reward — the payoff the whole game is built around.
 *
 * The band rule is enforced here: only `teaching` words get the full panel.
 * Common scaffolding like LION and CAN fills the grid with nothing more than a
 * checkmark. If CAT fired this panel, players would learn to ignore it within
 * a dozen levels and the mechanic would be dead.
 */
export default function DefinitionPanel() {
  const result = useActiveGame().lastResult
  if (!result) return null

  if (result.kind === 'invalid' || result.kind === 'tooShort' || result.kind === 'already') {
    return (
      <p className={styles.reject} data-testid="reject">
        {REJECTION[result.kind]}
      </p>
    )
  }

  const { entry } = result

  // Common band: acknowledge, teach nothing, stay out of the way.
  if (entry.band !== 'teaching') {
    return (
      <p className={styles.ack} data-testid="silent-ack">
        ✓ {entry.word}
      </p>
    )
  }

  return (
    <div
      className={result.kind === 'bonus' ? styles.rewardBonus : styles.reward}
      data-testid="definition-panel"
    >
      <div className={styles.rewardHead}>
        <span className={styles.word} data-testid="definition-word">
          {entry.word}
        </span>
        <span className={styles.pos}>{entry.pos}</span>
        {result.kind === 'bonus' && <span className={styles.bonusTag}>bonus</span>}
      </div>
      <p className={styles.definition} data-testid="definition-text">
        {entry.definition}
      </p>
      {entry.example && <p className={styles.example}>“{entry.example}”</p>}
    </div>
  )
}
