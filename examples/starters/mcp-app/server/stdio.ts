import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './mcp';

// stdout is reserved for the MCP protocol. Do not print note text or diagnostics.
const server = createServer();
await server.connect(new StdioServerTransport());
