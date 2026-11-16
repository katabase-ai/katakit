# Pull request previews

`.github/workflows/deploy-preview.yml` builds the docs viewer and demo gallery on
every PR. For branches in this repository, it uploads each site to its own
Cloudflare Worker and maintains a PR comment with its stable `pr-<number>` URL.
Fork PRs build both sites but skip uploads and comments because repository
credentials are unavailable.

These are the standalone sites served by `pnpm -F @katakit/docs dev` and
`pnpm -F @katakit/gallery dev`. Docs are static assets; the gallery is a TanStack
Start Worker with client assets. Docs include authored
pages only. Neither preview checks out ProtoZoa, exports the documentation
bundle, or builds the consuming website. The website's rendering of Katakit
content is reviewed in that website's own previews.

## Cloudflare setup

This follows protozoa-app's `wrangler versions upload --preview-alias` workflow.
The two preview Workers are `katakit-docs-preview` and
`katakit-gallery-preview`; their Wrangler configurations enable version
URLs. Docs use an HTML fallback for direct links; Start handles gallery routes and
not-found responses. The gallery source configuration is `demos/gallery/wrangler.jsonc`;
the Vite build generates `demos/gallery/dist/server/wrangler.json` for upload.

Both Workers have been initialized in protozoa-app's Cloudflare account
(`df336523814581dc72f26c5b15fcfa8f`). Their default deployments are available at
[the docs viewer](https://katakit-docs-preview.abe-df3.workers.dev) and
[the gallery](https://katakit-gallery-preview.abe-df3.workers.dev). PR uploads
update their aliases independently of these default deployments.

1. Set the GitHub Actions repository variable `CLOUDFLARE_ACCOUNT_ID` to the
   Cloudflare account that owns these Workers. To use the same account as
   protozoa-app, use the `account_id` in its `pkgs/fe/wrangler.docs.jsonc`.
2. Make the `CLOUDFLARE_API_TOKEN` secret available to this repository, with
   Workers Scripts edit permission for that account. Existing organization
   secrets may need this repository added to their access list.
3. When setting up a new account or recreating a Worker, bootstrap it once from
   a trusted checkout, using the same account and a Cloudflare login or API token:

   ```sh
   pnpm install --frozen-lockfile
   pnpm --filter @katakit/docs... build
   pnpm --filter @katakit/gallery... build
   pnpm exec wrangler deploy --config wrangler.docs.jsonc
   pnpm exec wrangler deploy --config demos/gallery/dist/server/wrangler.json
   ```

   Set `CLOUDFLARE_ACCOUNT_ID` in that shell too. An initial deployment is
   required before Cloudflare accepts `versions upload`. Subsequent PR runs
   upload preview versions without changing either Worker's default deployment.

4. Open a PR and check both preview comments. Preview URLs use the account's
   `workers.dev` subdomain; the workflow reads the actual aliases from Wrangler's
   output. No custom domain or backend service is required.

The gallery's `public/_headers` is copied into its output by Vite. Cloudflare
applies COOP/COEP to the document and runtime assets so Moonshine can use shared
memory, matching the local server's isolation settings. Keep the generated
`transcription-assets/` files with the gallery when deploying it.

## Verify a preview

- Follow and reload a docs page and a gallery demo URL directly; both should
  render through the docs HTML fallback or the gallery Start Worker, respectively.
- On a gallery demo, confirm `crossOriginIsolated` is `true`, runtime JavaScript
  and WASM requests succeed, and microphone transcription works after granting
  permission and downloading a model.
- Check the commit shown in each PR comment. Builds and uploads can fail
  independently for the two sites; the comment links to the corresponding run.

Cloudflare documents [version URLs and aliases](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/),
[deployment management](https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/),
and [static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/).
