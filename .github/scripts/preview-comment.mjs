/** Native Worker Previews return structured URLs; require the exact branded PR address. */
export const galleryPreviewUrl = (log, number) => {
  if (!/^[1-9]\d*$/.test(String(number))) throw new Error('Invalid PR number');
  const expected = `https://pr-${number}.katakit-preview.katabase.com`;
  // Wrangler 4.162 emits module/asset progress on stdout even with --json.
  const jsonStart = log.search(/^\s*\{/m);
  if (jsonStart === -1) throw new Error('Upload did not report Preview JSON.');
  const output = JSON.parse(log.slice(jsonStart));
  if (!output.preview?.urls?.includes(expected))
    throw new Error('Upload did not report the expected branded gallery Preview URL.');
  return expected;
};

/** Wrangler prints both an immutable version URL and the stable PR alias; report the alias. */
export const previewAliasUrl = (log, number) => {
  const urls = log.match(/https:\/\/[a-zA-Z0-9.-]+\.workers\.dev\b/g) ?? [];
  const url = urls.find(url => url.startsWith(`https://pr-${number}-`));
  if (!url) throw new Error('Upload did not report the expected PR alias URL.');
  return url;
};

/** Keep one comment per viewer and avoid letting an older run overwrite the current PR head. */
export const updatePreviewComment = async ({ github, context, site, status, log }) => {
  const pullRequest = context.payload.pull_request;
  const { data: current } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: pullRequest.number,
  });
  if (current.head.sha !== pullRequest.head.sha) return;

  const marker = `<!-- katakit-preview-${site.toLowerCase()} -->`;
  const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
  const result =
    status === 'success'
      ? `[Open ${site.toLowerCase()} preview](${site === 'Gallery' ? galleryPreviewUrl(log, pullRequest.number) : previewAliasUrl(log, pullRequest.number)})`
      : 'Build or deployment failed';
  const body = `${marker}\n**${site} preview** for ${pullRequest.head.sha.slice(0, 7)}: ${result} — [workflow run](${runUrl})`;
  const params = { ...context.repo, issue_number: pullRequest.number };
  const comments = await github.paginate(github.rest.issues.listComments, params);
  const existing = comments.find(
    comment => comment.user?.type === 'Bot' && comment.body?.startsWith(marker)
  );
  if (existing) {
    await github.rest.issues.updateComment({
      ...context.repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await github.rest.issues.createComment({ ...params, body });
  }
};
