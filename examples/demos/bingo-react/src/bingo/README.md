# Local Bingo plugin

This module implements the browser and extension examples’ conversation bingo
card. Each application imports its own `./bingo` source directory. It is not
published as a standalone package.

Import it from `./bingo` in either application. Register `makeBingoPlugin().configure({})`
with `makeKatakit`, then use `getMethods(Bingo).setTurns(turns)` to supply the complete
current turn list (`{ id, text }[]`). Alternatively, pass a `TranscriptIngestionPlugin` to
`makeBingoPlugin({ TranscriptIngestionPlugin })` when both are registered in one runtime.
The bingo plugin synchronously projects the ingestion plugin's atomic transcript
state, including when no UI is mounted. It includes the current turn, whose words
are finalized, but not provisional text. In this mode ingestion owns input and
`setTurns` is unavailable. In standalone mode `setTurns` records a replacement;
identical replacements are ignored and `setTurns([])` clears transcript evidence.

`state$` exposes the 25 squares, manual `overrides`, matched `evidence`, `marked`
flags, and `winningLines`. The center is always free. `setOverride(index, value)`
sets or clears a manual correction; `setSquares(makeSquares(phrases))` replaces a
card of 24 phrases. Each command appends to `@katakit/event-log`; deterministic
projections derive the board, evidence, marks and wins. `restoreBoard({ squares,
overrides })` migrates a legacy persisted board by appending one validated
`board-set` event. It never restores transcript content.

By default the plugin owns an in-memory log. Capture its replaying `events$` and
restore with `configure({ initialEvents })`; every restored event is validated.
For a caller-owned log pass `eventLog: { events$, emitEvent }` to the factory.
The host must validate initial history with `parseBingoEvent` and live writes
with `bingoEventSchema`, and provide a replaying, synchronous event stream.
Filter a host union down to `BingoEvent` before binding it. Do not also pass
`initialEvents` when binding a host log.

The log records actual shuffled squares, explicit override additions/removals,
and standalone transcript replacements. Replay never shuffles, generates IDs,
appends events, or opens resources. Hosts that persist only board preferences
can retain `board-set`/`override-set` events separately from session transcript
history. The browser demo uses one host log for both kinds of content; the
extension owns its board persistence policy.

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

When an application releases a card, call its idempotent `close()` method to
complete projections and detach log/transcript subscriptions. Late commands are
ignored. The host separately stops/drains audio and closes transcript ingestion,
which owns its live silence timer. Bingo owns no timers, network or storage.
