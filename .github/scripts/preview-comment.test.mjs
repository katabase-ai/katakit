import assert from 'node:assert/strict';
import { test } from 'node:test';
import { previewAliasUrl, updatePreviewComment } from './preview-comment.mjs';

const sha = '1234567890';
const context = {
  repo: { owner: 'katabase-ai', repo: 'katakit' },
  payload: { pull_request: { number: 42, head: { sha } } },
  serverUrl: 'https://github.com',
  runId: 123,
};
const alias = 'https://pr-42-katakit-docs-preview.example.workers.dev';
const log = `Version Preview URL: https://abcdef-katakit-docs-preview.example.workers.dev\nVersion Preview Alias URL: ${alias}\n`;

const client = ({ head = sha, comments = [] } = {}) => {
  const writes = [];
  const github = {
    rest: {
      pulls: { get: async () => ({ data: { head: { sha: head } } }) },
      issues: {
        listComments: () => {},
        createComment: async params => writes.push({ operation: 'create', ...params }),
        updateComment: async params => writes.push({ operation: 'update', ...params }),
      },
    },
    paginate: async () => comments,
  };
  return { github, writes };
};

test('selects this PR alias rather than an immutable or another PR URL', () => {
  assert.equal(previewAliasUrl(`https://pr-4-other.example.workers.dev\n${log}`, 42), alias);
  assert.throws(() => previewAliasUrl(log, 43), /expected PR alias/);
});

test('creates a viewer comment without overwriting another viewer or a human comment', async () => {
  const { github, writes } = client({
    comments: [
      { id: 1, user: { type: 'Bot' }, body: '<!-- katakit-preview-gallery -->' },
      { id: 2, user: { type: 'User' }, body: '<!-- katakit-preview-docs -->' },
    ],
  });
  await updatePreviewComment({ github, context, site: 'Docs', status: 'success', log });
  assert.equal(writes[0].operation, 'create');
  assert.match(writes[0].body, /Docs preview.*1234567/);
  assert.ok(writes[0].body.includes(alias));
});

test('replaces an old success with failure and its workflow link', async () => {
  const { github, writes } = client({
    comments: [{ id: 7, user: { type: 'Bot' }, body: '<!-- katakit-preview-docs -->' }],
  });
  await updatePreviewComment({ github, context, site: 'Docs', status: 'failure', log: '' });
  assert.equal(writes[0].operation, 'update');
  assert.equal(writes[0].comment_id, 7);
  assert.match(writes[0].body, /Build or deployment failed/);
  assert.match(writes[0].body, /actions\/runs\/123/);
  assert.ok(!writes[0].body.includes(alias));
});

test('an obsolete run cannot change the comment for a newer commit', async () => {
  const { github, writes } = client({ head: 'newer' });
  await updatePreviewComment({ github, context, site: 'Docs', status: 'success', log });
  assert.deepEqual(writes, []);
});
