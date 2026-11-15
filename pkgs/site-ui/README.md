# @katakit/site-ui

Private, source-only UI bridge for Katakit docs and gallery. Import
`@katakit/site-ui/styles.css` once per application, then use `Button`,
`SelectField`, `Notice`, and `AudioLevelMeter` from `@katakit/site-ui`.
The meter takes `{ active, level, label? }`; hosts feed it normalized PCM activity
through `createAudioLevelReporter` or `audioLevel` from
`@katakit/site-ui/audio-level`. It does not request microphone permissions or
store audio. Its CSS is bundled with the component, so the extension can use it
without importing the site's global foundation styles.

The slate/blue/tomato scale and compact button variants are adapted from
ProtoZoa's `pkgs/fe/src/theme.ts` and `pkgs/fe/src/ui/Button.tsx`. This is not
a published design system or a copy of its Tailwind/Base UI implementation.
Page layouts and feature-specific components stay in the host application.
