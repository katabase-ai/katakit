# Color clash

Say the ink color, not the word. A 20-second game uses on-device speech recognition
to score spoken answers. The first play downloads a speech model; microphone audio
and recognized text stay on your device.

This example demonstrates local microphone capture, provisional and final speech
handling, and replayable targets, answers, and score recorded with core's
`EventLogPlugin`. The host owns the microphone; the instruction screen and live
transcript are transient, and replay does not restart capture or the round clock.

See [AGENTS.md](AGENTS.md) for independent setup, code organization, hosting, and
manual checks. Those instructions are for both people and coding agents.
