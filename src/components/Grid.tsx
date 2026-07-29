import { buildCells, gridWords } from '../game/engine'
import { useActiveGame, useGame } from '../game/store'
import styles from './Grid.module.css'

/**
 * Display-only crossword grid. Unlike a real crossword there is no cursor and
 * no typing here — letters arrive from the pool below. The one interaction is
 * tapping an unsolved square to reveal its definition as a prompt, which is
 * what turns this from an anagram game into a vocabulary game.
 */
export default function Grid() {
  const game = useActiveGame()
  const showPrompt = useGame((s) => s.showPrompt)

  const cells = buildCells(game.level, game.solved)
  const words = gridWords(game.level)

  return (
    <div
      className={styles.grid}
      style={{ '--cols': game.level.cols, '--rows': game.level.rows } as React.CSSProperties}
      data-testid="grid"
    >
      {cells.flatMap((row, r) =>
        row.map((cell, c) => {
          if (!cell) return <span key={`${r}-${c}`} className={styles.gap} aria-hidden="true" />

          // A square can belong to two words; prompt for the first still unsolved.
          const target = cell.words.find((w) => words.includes(w) && !game.solved.includes(w))

          return (
            <button
              key={`${r}-${c}`}
              className={cell.revealed ? styles.filled : styles.empty}
              onClick={() => target && showPrompt(target)}
              disabled={cell.revealed || !target}
              data-testid={cell.revealed ? 'cell-filled' : 'cell-empty'}
              aria-label={cell.revealed ? cell.letter : 'blank square, tap for a clue'}
            >
              {cell.revealed ? cell.letter : ''}
            </button>
          )
        }),
      )}
    </div>
  )
}
