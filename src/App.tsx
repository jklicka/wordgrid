import { useState } from 'react'
import Credits from './components/Credits'
import Stats from './components/Stats'
import DefinitionPanel from './components/DefinitionPanel'
import Grid from './components/Grid'
import LetterPool from './components/LetterPool'
import LevelComplete from './components/LevelComplete'
import PromptPanel from './components/PromptPanel'
import WordTray from './components/WordTray'
import { gridWords, isComplete } from './game/engine'
import { useGame } from './game/store'
import styles from './App.module.css'
import panels from './components/Panels.module.css'

export default function App() {
  const game = useGame((s) => s.game)
  const levelIndex = useGame((s) => s.levelIndex)
  const [showCredits, setShowCredits] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const mode = useGame((s) => s.mode)
  const streak = useGame((s) => s.streak())

  // Gate: nothing below mounts until the first level chunk resolves, which is
  // what lets every child treat the game as non-null.
  if (!game) {
    return (
      <div className={styles.app}>
        <div className={styles.loading} data-testid="loading">
          WordGrid
        </div>
      </div>
    )
  }

  const words = gridWords(game.level)
  const done = isComplete(game)

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <button className={styles.progress} onClick={() => setShowStats(true)} data-testid="progress">
          {mode === 'daily' ? 'Daily' : `L${levelIndex + 1}`} · {game.solved.length}/{words.length}
          {streak > 0 && <span className={styles.streak}> 🔥{streak}</span>}
        </button>
        <span className={styles.learned} data-testid="learned-count">
          ✦ {game.learned.length} learned
        </span>
        <span className={styles.bonusCount} data-testid="bonus-count">
          +{game.foundBonus.length} bonus
        </span>
        <button
          className={styles.info}
          onClick={() => setShowCredits(true)}
          aria-label="about and credits"
          data-testid="credits-open"
        >
          ⓘ
        </button>
      </header>

      <main className={styles.board}>
        <Grid />
      </main>

      {/* Fixed-height band. Only one of these renders at a time — starting a
          new selection retires both — and the height never changes, so the
          wheel below stays put under the player's thumb. */}
      <section className={panels.band}>
        <PromptPanel />
        <DefinitionPanel />
      </section>

      <footer className={styles.footer}>
        <WordTray />
        <LetterPool />
      </footer>

      {done && <LevelComplete />}
      {showStats && <Stats onClose={() => setShowStats(false)} />}
      {showCredits && <Credits onClose={() => setShowCredits(false)} />}
    </div>
  )
}
