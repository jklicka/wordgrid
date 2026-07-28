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
  const words = gridWords(game.level)
  const done = isComplete(game)

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.progress} data-testid="progress">
          {game.solved.length}/{words.length} words
        </span>
        <span className={styles.learned} data-testid="learned-count">
          ✦ {game.learned.length} learned
        </span>
        <span className={styles.bonusCount} data-testid="bonus-count">
          +{game.foundBonus.length} bonus
        </span>
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
    </div>
  )
}
