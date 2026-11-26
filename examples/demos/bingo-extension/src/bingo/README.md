# Local Bingo plugin

This module implements the browser and extension examples’ conversation bingo
card. Each application imports its own `./bingo` source directory. It is not
published as a standalone package.

One Katakit runtime is one round. Its first event, `gameStarted({ squares })`, records
one 25-phrase layout in row-major order. A live final
utterance can produce `squareSpoken({ index })` for each newly heard phrase.
A click records `squareManuallyChanged({ index, marked })`. A manual mark wins
over speech, including when someone later says a phrase the player unmarked.
Wins and counts are calculated; they are not additional events.

Register `BingoPlugin.configure({})` with `makeKatakit` and call
`getMethods(BingoPlugin).startGame(squares)` on the empty running kit. To replay,
pass the recorded events as `existingEvents` and read
`kit.getObservables(BingoPlugin).state$.get()` **without** starting the kit or
matching text again. With no opening event this returns `undefined`.
`createBingoSession()` owns the active runtime for the demo. Its `restart(squares)`
switches to a new log and transcript without stopping the host's microphone.

`bingoPacks` provides meeting phrases, animals, US states, world capitals,
tricky-to-pronounce words, corporate jargon, and AI technical jargon. Each
pack has familiar, less familiar, and wildcard entries. `drawBingoPack(id)`
samples up to nine phrases per tier, shuffles the pool, and deals 25 phrases.

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

When the host finishes draining input, call the session's `flush()` and `close()`.
