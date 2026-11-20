# Pull request previews

`.github/workflows/deploy-preview.yml` builds the docs viewer and demo gallery on
every PR. For branches in this repository, it uploads each site to Cloudflare Workers and maintains PR comments with stable URLs.
Fork PRs build both sites but skip uploads and comments because repository
credentials are unavailable.

These are the standalone sites served by `pnpm -F @katakit/docs dev` and
`pnpm -F @katakit/gallery dev`. Docs are static assets; the gallery is a TanStack
Start Worker with client assets. Docs include authored
pages only. Neither preview checks out ProtoZoa, exports the documentation
bundle, or builds the consuming website. The website's rendering of Katakit
content is reviewed in that website's own previews.

Gallery PR builds explicitly set `VITE_GALLERY_DEV_MODE=true` so reviewers can inspect Operation
Setup/Grid and developer-only BYOK. The header's **Preview** toggle switches to the public gallery
experience while preserving a way back to developer tools. Public preview ignores saved developer
keys and uses the deployed host's managed connection.
Switching either direction pauses inference and requires an explicit restart. This build flag is
scoped to the gallery PR build step; normal production builds remain public. The `pnpm preview`
command only serves the last built artifact locally and does not choose its mode. See the gallery's
[mode reference](../examples/demos/gallery/README.md#developer-mode-and-public-preview).

## Cloudflare setup

Docs use `wrangler versions upload --preview-alias`; the gallery uses native
`wrangler preview --name pr-<number>` with a branded custom domain. The two preview Workers are `katakit-docs-preview` and
`katakit-gallery-preview`; their Wrangler configurations enable version
URLs. Docs use an HTML fallback for direct links; Start handles gallery routes and
not-found responses. The gallery source configuration is `examples/demos/gallery/wrangler.jsonc`;
the Vite build generates `examples/demos/gallery/dist/server/wrangler.json` for upload.

Both Workers have been initialized in protozoa-app's Cloudflare account
(`df336523814581dc72f26c5b15fcfa8f`). Their default deployments are available at
[the docs viewer](https://katakit-docs-preview.abe-df3.workers.dev) and
[the gallery](https://katakit-gallery-preview.abe-df3.workers.dev). PR uploads
update docs aliases and named gallery Previews independently of these default deployments.

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
   pnpm build:pkgs
   pnpm --filter @katakit/docs build
   pnpm --filter @katakit/gallery build
   pnpm exec wrangler deploy --config wrangler.docs.jsonc
   pnpm exec wrangler deploy --config examples/demos/gallery/dist/server/wrangler.json
   ```

   Set `CLOUDFLARE_ACCOUNT_ID` in that shell too. An initial deployment is
   required before Cloudflare accepts `versions upload`. Subsequent PR runs
   upload preview versions without changing either Worker's default deployment.

4. Open a PR and check both preview comments. Preview URLs use the account's
   `workers.dev` subdomain for docs. Gallery links are
   `https://pr-<number>.katakit-preview.katabase.com`; configure the preview-only custom domain
   and managed inference below before enabling gallery CI. The workflow reads the actual URLs
   from Wrangler's output.

The gallery's `public/_headers` is copied into its output by Vite. Cloudflare
applies COOP/COEP to the document and runtime assets so Moonshine can use shared
memory, matching the local server's isolation settings. Keep the generated
`transcription-assets/` files with the gallery when deploying it.

## Managed inference for every gallery PR preview

The gallery host adapts ProtoZoa's existing anonymous demo service. CI supplies
`VITE_GALLERY_DEMO_PROXY_URL` and the exact `VITE_GALLERY_PREVIEW_ORIGIN` only for same-repository
gallery PR builds. Set this Katakit repository **Actions variable**:

- `KATAKIT_DEMO_PROXY_URL=https://katakit-demo-proxy.abe-df3.workers.dev`

The connection is offered in both developer and public UI modes. The header's Preview toggle
does not enable deployment access. Ordinary local development, normal production builds, fork
builds and a CI artifact served on another origin have no managed connection. Developer BYOK
remains available in developer view. Models and sessions are requested only after a demo action;
loading a page does not create a session or spend allowance.

### One-time Cloudflare and proxy setup

1. Adopt the companion ProtoZoa demo-server change and deploy the existing proxy. Preserve its
   Worker/Durable Object identity, installed secrets, and enabled/paused setting. Its Wrangler
   variable is `GALLERY_PREVIEW_DOMAIN=katakit-preview.katabase.com`. Only HTTPS origins matching
   `https://pr-<positive-number>.katakit-preview.katabase.com` are admitted. Existing exact
   `BROWSER_ORIGINS` for the website and check page stay allowed. Parent/nested domains,
   immutable deployment URLs, old workers.dev aliases, docs and localhost are rejected.
2. In the Cloudflare dashboard, select account `df336523814581dc72f26c5b15fcfa8f`, then
   **Application security → Turnstile → Katakit demo model proxy → Edit Widget**.
   Add **`katakit-preview.katabase.com`** under Hostname Management, preserving existing
   hostnames, Managed mode and disabled pre-clearance. Do not rotate the secret. Cloudflare
   includes subdomains automatically, so one entry covers every PR without hitting the free
   widget's ten-hostname limit. The proxy still checks the exact requesting hostname and the
   `demo_session` action. Do not authorize the entire `katabase.com` or `workers.dev` domains.
3. Open **Compute → Workers & Pages → katakit-gallery-preview → Domains** (or
   **Settings → Domains & Routes**, depending on the dashboard version). Add the Custom Domain
   **`katakit-preview.katabase.com`**, enabled for **Preview only**. Cloudflare creates the
   wildcard DNS record and certificate. The checked-in gallery Wrangler routes preserve this
   setting on later deployments. No gateway, account rename, manual wildcard DNS record, or
   per-PR domain registration is needed. TLS issuance can take time for the first Preview.
4. Set the Katakit Actions variable `KATAKIT_DEMO_PROXY_URL` above. The CI token needs
   **Account → Workers Scripts → Edit** for this account; the parent custom domain is configured
   once in the dashboard. Do not add Turnstile-management or provider secrets to CI.
5. Open or update a same-repository PR. CI creates/updates a native Preview named `pr-<number>`
   and verifies that Wrangler reported the exact branded origin compiled into the build.
   It checks `/config`, session/model preflights and `401 session_required` without credentials.
   No session, Turnstile challenge or paid call is created by these CI checks.

The gallery uses the pinned Wrangler's native Previews support (`previews: {}`); docs retain
version aliases. Closing a PR deletes only its named gallery Preview. The cleanup job uses main's
configuration, checks that the PR is still closed, and shares deployment concurrency so an old
cleanup cannot delete a newly reopened PR's deployment. The parent Worker/domain and docs stay.
Previews use the existing proxy's shared session/network/global limits and provider budget.

Cloudflare documents [hostname inheritance and limits](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/),
[Preview custom domains](https://developers.cloudflare.com/workers/previews/custom-domains/), and
[CI creation and cleanup](https://developers.cloudflare.com/workers/previews/examples/).

## Verify a preview

- In the gallery, open Operation Setup and Operation Grid. Enable the header's Preview toggle:
  developer controls should disappear, leaving public status/download rows. Disable it to return.
  Do not enter real provider credentials just to review the layout.
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

For managed inference, start a remote-model demo in the deployed gallery and complete the real
Turnstile check if prompted. Verify that the session allowance appears and a completion succeeds,
then navigate/reload and verify the same tab's remaining allowance is recovered. Check public and
developer views, expiry/exhaustion, cancellation and unavailable-service messages. Real browser
verification is required under the site's COOP/COEP headers; mocked transport tests and CI origin
checks do not establish widget or paid-provider behavior.
