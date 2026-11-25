# Event-sourced conversation bingo

> Status: implemented

## Game contract

One runtime represents one game. The built-in event log owns the board; the Bingo plugin applies `evolve` to its three event types. UI, microphone and transcript ingestion do not own writable board state.

| Event                                      | Meaning                                                                                                                                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gameStarted({ cards })`                   | First event, sequence zero, exactly once. `cards` contains the actual dealt layout, including its free center. This single-player demo has exactly one card, so a square index is unambiguous. |
| `squareManuallyChanged({ index, marked })` | Set a player's correction to true or false. Corrections take precedence over speech.                                                                                                           |
| `squareSpoken({ index })`                  | Live recognition matched this square. Record it once per square, regardless of corrections. A recorded match survives changes to the matcher.                                                  |

An unstarted projection has no board. The free center is always marked; the other squares are marked according to their correction or, in its absence, their spoken flag. Score and winning lines follow from the marks. Every game prefix after the deal yields a complete, playable board without running recognition, timers, or random draws.

## Starting and restarting

Pack selection and Shuffle construct a new runtime before handing it the existing capture sink. Dispose of the old round's silence timer and detach the old views. Speech, wins, and corrections from one deal do not affect another. Stopping and starting the browser microphone alone does not redeal.

The browser and gallery use the same session. Chrome retains its local saved layout, corrections and picker preferences. It keeps bounded final segments in session storage for panel reopen; a new deal clears that cache. Resuming from these host inputs initializes a new game, not a reconstruction of the missing historical sequence. Starting a new capture resets speech and imports the current card settings. No database or storage-shape migration is required.

## Design changes after research

The [research](../research/bingo-event-sourcing/README.md) identified the old writable board and incompatible transcript bridges. The initial design proposed keeping the same game across shuffles and recalculating all matches from its transcript. The selected design instead records accepted speech matches and gives every deal its own runtime. The game log can now reproduce a board without keeping any transcript text in Bingo events.

See the [migration plan and checks](bingo-event-sourcing.plan.md) and [plugin guide](../examples/demos/bingo-react/src/bingo/README.md).
