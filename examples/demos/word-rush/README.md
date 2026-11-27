# Word rush

Speak answers to a timed challenge and collect qualifying answers on a sticky-note board. The
browser transcribes speech locally; a host-supplied model extracts candidates and judges them.
You can remove mistaken answers, retry judging, and start another round. The board and transcript
are held in memory for one visit.

This demo shows how to derive game content from logged events while keeping capture, the round
clock, admission, and requests with their live owners. The standalone app and gallery use the same
feature code without importing one another.

See [AGENTS.md](AGENTS.md) for independent setup, model requirements, code organization,
customization, hosting, and manual verification.
