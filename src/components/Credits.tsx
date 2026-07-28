import styles from './Credits.module.css'

/**
 * Credits, and the WordNet notice.
 *
 * Not decoration: WordNet's licence requires its copyright notice to appear on
 * ALL copies of the data. Definitions ship inside every level file, so the
 * obligation attaches to the app itself, not just to the repo's NOTICE file.
 */
export default function Credits({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.overlay} onClick={onClose} data-testid="credits">
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>WordGrid</h2>
        <p className={styles.body}>
          A vocabulary game. Solve a word, learn what it means — every
          mid-frequency word you find is added to your Words Learned list.
        </p>

        <p className={styles.section}>Definitions</p>
        <p className={styles.body}>
          Definitions, parts of speech and examples come from <strong>WordNet 3.0</strong>.
        </p>
        <p className={styles.legal}>
          WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved.
          WordNet is provided “as is”; Princeton University makes no representations
          or warranties, express or implied, and is not affiliated with or endorsing
          this app.
        </p>

        <p className={styles.section}>Word frequency</p>
        <p className={styles.legal}>
          Band assignments derive from the <strong>wordfreq</strong> package (MIT),
          which blends books, Wikipedia, news, subtitles and web text.
        </p>

        <button className={styles.close} onClick={onClose} data-testid="credits-close">
          Close
        </button>
      </div>
    </div>
  )
}
