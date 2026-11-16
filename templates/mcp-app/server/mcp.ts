import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';

export const resourceUri = 'ui://katakit/notes/v1.html';
const cardPath = fileURLToPath(new URL('./index.html', import.meta.url));

export const createServer = () => {
  const server = new McpServer({ name: 'Katakit notes', version: '0.1.0' });
  registerAppTool(
    server,
    'open_notes_card',
    {
      title: 'Open Katakit notes',
      description:
        'Open an interactive Katakit notes card with sample text. No account, model, or microphone is needed.',
      inputSchema: {},
      _meta: { ui: { resourceUri } },
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: 'The Katakit notes card is ready. Enter sample text and select Add note. No note text is sent back to this MCP server.',
        },
      ],
    })
  );
  registerAppResource(
    server,
    'notes-card',
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [
        { uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: await readFile(cardPath, 'utf8') },
      ],
    })
  );
  return server;
};
