# @katakit/site-ui

Private, source-only UI bridge for Katakit docs and gallery. Import
`@katakit/site-ui/styles.css` once per application, then use `Button`,
`SelectField`, and `Notice` from `@katakit/site-ui`.

The slate/blue/tomato scale and compact button variants are adapted from
ProtoZoa's `pkgs/fe/src/theme.ts` and `pkgs/fe/src/ui/Button.tsx`. This is not
a published design system or a copy of its Tailwind/Base UI implementation.
Page layouts and feature-specific components stay in the host application.
