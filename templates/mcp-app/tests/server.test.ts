import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resourceUri } from '../server/mcp';

test('copied template exposes the bundled interactive card over stdio', async () => {
  const client = new Client({ name: 'template-smoke-test', version: '0.1.0' });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [join(import.meta.dirname, '../dist/server.mjs')],
        cwd: import.meta.dirname,
        stderr: 'pipe',
      })
    );
    const { tools } = await client.listTools();
    assert.deepEqual(tools.find(tool => tool.name === 'open_notes_card')?._meta?.ui, {
      resourceUri,
    });
    const result = await client.callTool({ name: 'open_notes_card', arguments: {} });
    assert.match(JSON.stringify(result.content), /No note text is sent back/);
    const resource = await client.readResource({ uri: resourceUri });
    const card = resource.contents[0];
    assert.equal(card.mimeType, 'text/html;profile=mcp-app');
    assert.ok('text' in card);
    assert.match(card.text, /A note supplied by the card/);
    assert.match(card.text, /Add note/);
    assert.ok(card.text.length < 1_000_000, 'card should stay small enough for stdio');
  } finally {
    await client.close();
  }
});
