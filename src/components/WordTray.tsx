import { useEffect, useState } from 'react'
import { currentWord } from '../game/engine'
import { useGame } from '../game/store'
import styles from './Pool.module.css'

/** The word being assembled, with undo and submit. */
export default function WordTray() {
  const game = useGame((s) => s.game)
  const undoLetter = useGame((s) => s.undoLetter)
  const submitWord = useGame((s) => s.submitWord)

  const word = currentWord(game)
  const rejected = game.lastResult?.kind === 'invalid' || game.lastResult?.kind === 'tooShort'

  // Remounting on each rejection is what replays the shake animation; the
  // component is purely presentational so this is free.
  const [shakeKey, setShakeKey] = useState(0)
  useEffect(() => {
    if (rejected) setShakeKey((k) => k + 1)
  }, [game.lastResult, rejected])

  return (
    <div className={styles.trayRow}>
      <button
        className={styles.control}
        onClick={undoLetter}
        disabled={word.length === 0}
        aria-label="undo last letter"
        data-testid="undo"
      >
        ⌫
      </button>

      <div
        key={shakeKey}
        className={rejected ? styles.trayBad : styles.tray}
        data-testid="word-tray"
      >
        {word.length > 0 ? (
          [...word].map((letter, i) => (
            <span key={i} className={styles.trayLetter}>
              {letter}
            </span>
          ))
        ) : (
          <span className={styles.trayHint}>Tap letters to build a word</span>
        )}
      </div>

      <button
        className={styles.controlGo}
        onClick={submitWord}
        disabled={word.length === 0}
        aria-label="submit word"
        data-testid="submit"
      >
        ✓
      </button>
    </div>
  )
}
