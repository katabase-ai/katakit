# Local Bingo plugin

This module implements the browser and extension examples’ conversation bingo
card. Each application imports its own `./bingo` source directory. It is not
published as a standalone package.

Import it from `./bingo` in either application. Register `makeBingoPlugin().configure({})`
with `makeKatakit`, then use `getMethods(Bingo).setTurns(turns)` to supply the complete
current turn list (`{ id, text }[]`). Alternatively, pass a `TranscriptIngestionPlugin` to
`makeBingoPlugin({ TranscriptIngestionPlugin })` when both are registered in one runtime.
The bingo plugin then reacts to finalized segments, completed turns, and resets
through a runtime effect, including when no UI is mounted. It includes the current
turn, whose words are finalized, but not provisional text. Replacing the list
recomputes matches; duplicates and removed turns cannot leave stale matches.

`state$` exposes the 25 squares, manual `overrides`, matched `evidence`, `marked`
flags, and `winningLines`. The center is always free. `setOverride(index, value)`
sets or clears a manual correction; `setSquares(makeSquares(phrases))` replaces a
card of 24 phrases. `restoreBoard({ squares, overrides })` restores host-owned
board state. The plugin holds no audio, UI, storage, network access, or timers;
the host persists board settings if desired. Runtime effects currently have no
whole-runtime disposal hook; unmounting React does not stop the bingo effect.

`bingoPacks` provides meeting phrases, animals, US states, world capitals,
tricky-to-pronounce words, corporate jargon, and AI technical jargon. Each
pack has familiar, less familiar, and wildcard entries. `drawBingoPack(id)`
chooses eight from each tier and shuffles the resulting card. Hosts may still
pass a custom 24-phrase list to `makeSquares`.

## Geography coverage and sources

The **US states** pack includes all 50 states (not Washington, DC or territories),
checked against the [US Census Bureau state list](https://www2.census.gov/programs-surveys/bps/guidance/states-by-region.pdf).
The **world capitals** pack includes one capital or government seat for each of
the [193 UN member states](https://research.un.org/en/unmembers/currentmembers)
plus the two [UN observer states](https://research.un.org/en/unmembers/observers),
the Holy See (represented by Vatican City) and Palestine. Country/capital pairs
are recorded in `worldCapitals.ts`; the names were checked against the
[Barcelona Field Studies Centre's capital-city table](https://geographyfieldwork.com/WorldCapitalCities.htm)
(updated March 2026). These are curated bingo entries, not a diplomatic reference.

For countries with several seats, the single board entry uses Sucre (Bolivia's
constitutional capital), Porto-Novo (Benin), Amsterdam (Netherlands), Pretoria
(South Africa's executive seat), Mbabane (Eswatini's administrative seat),
Kuala Lumpur (Malaysia), and Sri Jayawardenepura Kotte (Sri Lanka). Yaren is
Nauru's **de facto** seat—[Nauru has no official capital](https://www.britannica.com/place/Yaren).
Palestine's entry is **East Jerusalem**, its claimed capital, not Ramallah,
where its administration is based; Jerusalem's status is
[disputed](https://www.britannica.com/place/Jerusalem-in-the-Israeli-Palestinian-conflict-Whose-capital-is-it-2231643).
The January 2026 designation of [Ciudad de la Paz](https://www.britannica.com/place/Ciudad-de-la-Paz-Equatorial-Guinea)
replaces Malabo for Equatorial Guinea. Jakarta remains Indonesia's capital
[pending a transfer decree](https://inp.polri.go.id/artikel/jakarta-remains-national-capital-pending-presidential-decree-constitutional-court).

The chosen English spellings are for card play; uncommon names and alternate
transliterations may not be recognized by Moonshine. Hosts allow manual corrections.

When an application releases a card, call its `close()` method to complete the state stream.
The application owns any transcript bridge subscriptions and must unsubscribe those separately.
