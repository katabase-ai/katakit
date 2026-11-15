# Demo gallery

Run `pnpm gallery:dev` from the repository root. The gallery lists demos at `/`
and mounts React demos at their own routes, starting with `/demos/transcription`.
Run `pnpm gallery:build` to build `demos/gallery/dist/`.

Add demos to `src/demos.tsx`. Use `kind: 'react'` with a component for demos that
can mount inside the shell, or `kind: 'landing'` with a content component for
extensions and other demos that need an informational page instead.
The gallery uses the shared `@katakit/site-ui` styles; demos may use its
`Button`, `SelectField`, and `Notice` components where appropriate.

Static hosting must serve `index.html` for unknown paths and use HTTPS. The
transcription route needs `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` on the document (and COEP on its
Moonshine assets). Vite dev and preview set these headers locally. The first
recording downloads a model; microphone input and transcript remain in-browser.
