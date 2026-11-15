# Bingo

`@katakit/bingo` exports `makeBingoPlugin()` for a source-neutral 5×5
conversation bingo card. It does not record audio, render a board, or persist
state. Register `Bingo.configure({})` with `makeKatakit`, then supply the full
list of finalized conversation turns with `getMethods(Bingo).setTurns(turns)`.
The plugin also accepts a turn still being assembled from finalized words, but
not provisional recognizer text.

## Board state and methods

`getObservables(Bingo).state$` gives `{ squares, overrides, evidence, marked,
winningLines }`. The middle square is free. Matching is case-insensitive,
ignores punctuation, and requires a whole phrase. `setSquares(makeSquares(phrases))`
replaces the card using 24 nonblank phrases and clears manual corrections.
`setOverride(index, true | false | undefined)` corrects a mark (or clears a
correction). `restoreBoard({ squares, overrides })` accepts saved application-owned
board settings. Replacing the turn list recomputes evidence and marks, so
removed or corrected turns do not leave stale matches.

`bingoPacks` and `drawBingoPack(id)` provide reusable word lists. Each draw
selects eight familiar, eight less familiar, and eight wildcard entries, then
shuffles their positions. The built-in lists cover meetings, animals, US states,
world capitals, tricky-to-pronounce words, corporate jargon, and AI jargon.
The geography lists cover 50 states and one capital or government seat for each
of 195 countries (193 UN members plus Vatican City and Palestine); see
`pkgs/bingo/README.md` for sources and edge cases.
Speech recognition may miss unusual words; applications can always use `setOverride`
to correct a square.

The [browser bingo demo](https://github.com/katabase-ai/katakit/tree/main/demos/bingo-react)
and [Chrome extension demo](https://github.com/katabase-ai/katakit/tree/main/demos/bingo-extension)
use the same plugin with different audio inputs. See [Transcript ingestion](transcript-ingestion.md)
for assembling text segments into turns.
