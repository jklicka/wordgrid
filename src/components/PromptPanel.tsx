import { useGame } from '../game/store'
import styles from './Panels.module.css'

/**
 * Definition-as-prompt.
 *
 * This is the change that makes WordGrid a vocabulary game rather than an
 * anagram game. Pure Wordscapes works because its words are common enough to
 * stumble onto; our target words are by definition ones the player does not
 * know, so blind discovery would stall on exactly the words worth teaching.
 * Tapping a blank square turns the puzzle into "which word means this?"
 */
export default function PromptPanel() {
  const game = useGame((s) => s.game)
  if (!game.promptWord) return null

  const entry = game.level.entries[game.promptWord]
  if (!entry) return null

  const length = game.promptWord.length

  return (
    <div className={styles.prompt} data-testid="prompt-panel">
      <div className={styles.promptMeta}>
        <span className={styles.badge}>{length} letters</span>
        <span className={styles.pos}>{entry.pos}</span>
      </div>
      <p className={styles.promptText} data-testid="prompt-gloss">
        “{entry.gloss}”
      </p>
    </div>
  )
}
