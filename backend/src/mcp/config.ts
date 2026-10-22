import dotenv from 'dotenv';

dotenv.config();

export const mcpConfig = {
  port: Number(process.env.MCP_PORT) || 3000,
  host: process.env.MCP_HOST || '0.0.0.0',
  endpoint: process.env.MCP_URL || 'http://localhost:3000/mcp',
  name: 'karma-mcp-server',
  version: '1.0.0',
};
