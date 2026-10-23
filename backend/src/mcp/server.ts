import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { mcpConfig } from './config.js';
import type { McpToolResponse } from './types.js';
import { searchProducts } from '../tools/shopping/searchProducts.js';
import { runAmazonShoppingWorkflow } from '../tools/shopping/amazonShoppingAgent.js';

const app = express();

app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json());

/* -------------------------------------------------------------------------- */
/* Tool Registrations Helper                                                  */
/* -------------------------------------------------------------------------- */

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: mcpConfig.name,
    version: mcpConfig.version,
  });

  // 1. manage_lists: Queries and modifies personal lists and checklists
  server.tool(
    'manage_lists',
    'Queries and modifies personal lists and checklists',
    {
      action: z.string().describe("Action to perform: 'query', 'create', 'add', 'remove', 'update'"),
      filter: z.string().optional().describe("Filter category or list name, e.g. 'active', 'shopping', 'packing'"),
      title: z.string().optional().describe('Title of list'),
      items: z.array(z.string()).optional().describe('Items to add or update'),
    },
    async ({ action, filter, title, items }): Promise<McpToolResponse> => {
      const activeLists = [
        { id: '1', name: 'Shopping List', count: 7, items: ['Organic Milk', 'Avocados', 'Sourdough Bread', 'Greek Yogurt', 'Coffee Beans'] },
        { id: '2', name: 'Maui Packing', count: 5, items: ['Swimwear', 'Sunscreen SPF 50', 'Snorkel gear', 'Hiking boots', 'Camera charger'] },
        { id: '3', name: 'Work Tasks', count: 3, items: ['Review PR #42', 'Architecture sync presentation', 'Deploy staging'] },
      ];

      const matched = filter ? activeLists.filter((l) => l.name.toLowerCase().includes(filter.toLowerCase())) : activeLists;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'ok',
              action,
              filter: filter || 'all',
              matchedLists: matched,
              totalActiveLists: activeLists.length,
              requestedItems: items || [],
            }, null, 2),
          },
        ],
      };
    }
  );

  // 2. travel_planner: Coordinates destinations, itineraries, and packing schedules
  server.tool(
    'travel_planner',
    'Coordinates destinations, itineraries, and packing schedules',
    {
      destination_query: z.string().describe("Destination or query, e.g. 'Plan a 3-day getaway to Maui'"),
      mode: z.string().optional().describe("Planning mode: 'itinerary', 'packing', 'flights', 'hotels'"),
    },
    async ({ destination_query, mode }): Promise<McpToolResponse> => {
      const planMode = mode || 'itinerary';
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'ok',
              destination: destination_query,
              mode: planMode,
              recommendation: {
                summary: `Travel plan generated for ${destination_query} (${planMode} mode)`,
                suggestedDuration: '3 Days',
                highlights: ['Morning scenic walk', 'Local cultural landmarks', 'Sunset coastal dining'],
                packingMustHaves: ['Light layers', 'Sun protection', 'Universal adapter'],
              },
            }, null, 2),
          },
        ],
      };
    }
  );

  // 3. home_assistant_core: Interacts with virtual smart devices and automated home routines
  server.tool(
    'home_assistant_core',
    'Interacts with virtual smart devices and automated home routines',
    {
      query: z.string().describe("Smart home command, e.g. 'Turn down living room lights'"),
      device: z.string().optional().describe('Target device or room'),
      state: z.string().optional().describe("Desired state, e.g. 'on', 'off', 'dim'"),
    },
    async ({ query, device, state }): Promise<McpToolResponse> => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'ok',
              action: 'device_state_updated',
              matchedIntent: query,
              device: device || 'Living Room Ambient Light',
              appliedState: state || 'dimmed_to_40%',
              confirmationMessage: `Set ${device || 'Living Room Ambient Light'} to ${state || '40%'}.`,
            }, null, 2),
          },
        ],
      };
    }
  );

  // 4. knowledge_retrieval: RAG retrieval from user-indexed personal knowledge documents with citations
  server.tool(
    'knowledge_retrieval',
    'RAG retrieval from user-indexed personal knowledge documents with citations',
    {
      subject: z.string().describe('Subject or query to retrieve from documents'),
      depth: z.string().optional().describe("Retrieval depth: 'overview', 'detailed', 'deep'"),
    },
    async ({ subject, depth }): Promise<McpToolResponse> => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'ok',
              query: subject,
              depth: depth || 'detailed',
              passages: [
                {
                  source: 'q3_operations_review.pdf',
                  page: 4,
                  paragraph: 2,
                  score: 0.94,
                  snippet: 'Agreed budget ceiling for Q3 operations was capped with a 15% reserve allocation.',
                },
                {
                  source: 'specs/voice-engine-v2.md',
                  section: 'Latency Targets',
                  score: 0.89,
                  snippet: 'Target time-to-first-token is under 350ms with local voice streaming fallback.',
                },
              ],
            }, null, 2),
          },
        ],
      };
    }
  );

  // 5. creative_studio: Generates outlines and structured conceptual content
  server.tool(
    'creative_studio',
    'Generates outlines and structured conceptual content',
    {
      prompt: z.string().describe('Creative prompt, concept, or routine request'),
      style: z.string().optional().describe("Style: 'concise', 'bullet', 'narrative', 'routine'"),
    },
    async ({ prompt, style }): Promise<McpToolResponse> => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'ok',
              prompt,
              style: style || 'routine',
              concept: {
                title: `Creative Concept: ${prompt.slice(0, 30)}...`,
                elements: [
                  'Warm ambient lighting transition (2700K)',
                  'Acoustic evening playlist automatically queued',
                  'Do Not Disturb enabled on mobile devices',
                ],
              },
            }, null, 2),
          },
        ],
      };
    }
  );

  // 6. maps_search: Resolves places and routes using geographic location data
  server.tool(
    'maps_search',
    'Resolves places and routes using geographic location data',
    {
      query: z.string().describe('Place or route search query'),
      location: z.string().optional().describe('Near location or starting point'),
    },
    async ({ query, location }): Promise<McpToolResponse> => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'ok',
              query,
              location: location || 'Current Location',
              places: [
                { name: 'Dolores Park Cafe', address: '501 Dolores St', distance: '0.2 miles', lat: 37.7598, lng: -122.4260 },
                { name: 'Four Barrel Coffee', address: '375 Valencia St', distance: '0.5 miles', lat: 37.7670, lng: -122.4218 },
                { name: 'Sightglass Coffee', address: '3014 20th St', distance: '0.8 miles', lat: 37.7588, lng: -122.4132 },
              ],
            }, null, 2),
          },
        ],
      };
    }
  );

  // 7. rag_ingest: Ingests PDF, text, and markdown documents into vector store
  server.tool(
    'rag_ingest',
    'Ingests PDF, text, and markdown documents into vector store',
    {
      file_path: z.string().optional().describe('Path of document to ingest'),
      content: z.string().optional().describe('Raw content of document to index'),
    },
    async ({ file_path, content }): Promise<McpToolResponse> => {
      const target = file_path || 'direct_text_payload';
      const bytesIndexed = content ? Buffer.byteLength(content, 'utf-8') : 1024;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'ok',
              file: target,
              chunksCreated: 4,
              bytesIndexed,
              message: `Document '${target}' successfully chunked and indexed into vector store.`,
            }, null, 2),
          },
        ],
      };
    }
  );

  // 8. search_products: Search real shopping products with optional INR budget filtering
  server.tool(
    'search_products',
    'Search real shopping products in India and filter them by maximum price in INR.',
    {
      query: z
        .string()
        .trim()
        .min(2)
        .max(200)
        .describe('Product search query, e.g. creatine monohydrate'),
      maxPriceINR: z
        .number()
        .positive()
        .optional()
        .describe('Maximum price in Indian rupees'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe('Maximum number of products to return; defaults to 5'),
    },
    async ({ query, maxPriceINR, limit }): Promise<McpToolResponse> => {
      try {
        const result = await searchProducts({ query, maxPriceINR, limit });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : 'Shopping search failed.',
            },
          ],
        };
      }
    }
  );

  // 9. shop_amazon: Automates real Amazon shopping search, AI candidate comparison, price verification, and cart addition up to checkout review with live screen-control overlay.
  server.tool(
    'shop_amazon',
    'Automate searching Amazon.in, comparing product candidates using AI under a specified INR budget, verifying live price on the product page, and adding the best option to cart up to checkout review with live desktop screen control overlay. Use this when the user asks to find and buy/cart products on Amazon.',
    {
      query: z
        .string()
        .trim()
        .min(2)
        .max(200)
        .describe('Product search query, e.g. "creatine monohydrate"'),
      maxPriceINR: z
        .number()
        .positive()
        .optional()
        .describe('Maximum budget in Indian rupees, e.g. 500'),
      requirements: z
        .string()
        .optional()
        .describe('Specific product criteria or preferences, e.g. "pure creatine, best value per serving"'),
    },
    async ({ query, maxPriceINR, requirements }): Promise<McpToolResponse> => {
      try {
        const result = await runAmazonShoppingWorkflow({
          query,
          maxPriceINR,
          requirements,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : 'Amazon shopping automation failed.',
            },
          ],
        };
      }
    }
  );

  return server;
}

// Single default server instance for quick inspection
export const mcpServer = createMcpServer();

/* -------------------------------------------------------------------------- */
/* Health & Info Endpoints                                                    */
/* -------------------------------------------------------------------------- */

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: mcpConfig.name,
    version: mcpConfig.version,
    transport: 'streamable-http',
    endpoint: '/mcp',
    timestamp: new Date().toISOString(),
  });
});

app.get('/mcp/status', (_req: Request, res: Response) => {
  res.json({
    service: mcpConfig.name,
    description: 'Karma Model Context Protocol (MCP) Server',
    version: mcpConfig.version,
    endpoint: '/mcp',
    sseEndpoint: '/sse',
    health: '/health',
  });
});

/* -------------------------------------------------------------------------- */
/* Streamable HTTP Transport (/mcp)                                           */
/* -------------------------------------------------------------------------- */

interface ActiveSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  open: number;
  lastActive: number;
}

const sessions = new Map<string, ActiveSession>();

const trackResponse = (session: ActiveSession, res: Response) => {
  if (!res.socket || res.destroyed) return;
  session.open++;
  res.on('close', () => {
    session.open--;
    session.lastActive = Date.now();
  });
};

// Cleanup idle sessions after 30 minutes
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
setInterval(() => {
  const cutoff = Date.now() - IDLE_TIMEOUT_MS;
  for (const [id, session] of sessions.entries()) {
    if (session.open === 0 && session.lastActive < cutoff) {
      session.transport.close().catch(() => {});
      session.server.close().catch(() => {});
      sessions.delete(id);
    }
  }
}, 60000).unref();

// GET /mcp
app.get('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  const acceptHeader = req.headers['accept'] || '';

  // If client wants an SSE stream
  if (acceptHeader.includes('text/event-stream')) {
    let session = sessionId ? sessions.get(sessionId) : undefined;

    if (!session) {
      // Create a new streamable session on the fly if not yet created
      const newSessionId = sessionId || randomUUID();
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
      });
      await server.connect(transport as any);
      session = { transport, server, open: 0, lastActive: Date.now() };
      sessions.set(newSessionId, session);
    }

    trackResponse(session, res);
    await session.transport.handleRequest(req, res);
    return;
  }

  // Browser / JSON inspection GET fallback
  res.json({
    status: 'ok',
    service: mcpConfig.name,
    version: mcpConfig.version,
    endpoint: '/mcp',
    description: 'Karma Streamable HTTP MCP Endpoint. Use POST with JSON-RPC messages, or connect via MCP client/inspector.',
    tools: [
      'manage_lists',
      'travel_planner',
      'home_assistant_core',
      'knowledge_retrieval',
      'creative_studio',
      'maps_search',
      'rag_ingest',
      'search_products',
      'shop_amazon',
    ],
  });
});

// POST /mcp
app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const session = sessionId ? sessions.get(sessionId) : undefined;

    let transport: StreamableHTTPServerTransport;

    if (session) {
      // 1. Existing stateful session
      transport = session.transport;
      trackResponse(session, res);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (isInitializeRequest(req.body)) {
      // 2. New stateful initialization request
      const server = createMcpServer();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newId) => {
          sessions.set(newId, {
            transport,
            server,
            open: 0,
            lastActive: Date.now(),
          });
        },
        onsessionclosed: (closedId) => {
          sessions.delete(closedId);
        },
      });

      await server.connect(transport as any);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // 3. Stateless request handling (for direct tool calls or clients without persistent sessions)
    const statelessServer = createMcpServer();
    const statelessTransport = new StreamableHTTPServerTransport({});

    await statelessServer.connect(statelessTransport as any);
    await statelessTransport.handleRequest(req, res, req.body);

    res.on('close', () => {
      statelessTransport.close().catch(() => {});
      statelessServer.close().catch(() => {});
    });
  } catch (error) {
    console.error('Error handling MCP POST request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal MCP server error',
        },
        id: null,
      });
    }
  }
});

// DELETE /mcp (Session termination per MCP spec)
app.delete('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    await session.transport.close().catch(() => {});
    await session.server.close().catch(() => {});
    sessions.delete(sessionId);
    res.status(200).json({ status: 'session closed', sessionId });
    return;
  }
  res.status(404).json({
    jsonrpc: '2.0',
    error: { code: -32001, message: 'Session not found' },
    id: null,
  });
});

/* -------------------------------------------------------------------------- */
/* Backward Compatible SSE Transport (/sse & /messages)                       */
/* -------------------------------------------------------------------------- */

const sseTransports = new Map<string, SSEServerTransport>();

app.get('/sse', async (_req: Request, res: Response) => {
  try {
    const transport = new SSEServerTransport('/messages', res);
    const sseServer = createMcpServer();

    sseTransports.set(transport.sessionId, transport);

    transport.onclose = () => {
      sseTransports.delete(transport.sessionId);
      sseServer.close().catch(() => {});
    };

    await sseServer.connect(transport as any);
  } catch (error) {
    console.error('Error establishing SSE transport:', error);
    if (!res.headersSent) {
      res.status(500).send('Error establishing SSE stream');
    }
  }
});

app.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string | undefined;
  if (!sessionId || !sseTransports.has(sessionId)) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Invalid or missing sessionId query parameter' },
      id: null,
    });
    return;
  }

  const transport = sseTransports.get(sessionId)!;
  await transport.handlePostMessage(req, res, req.body);
});

/* -------------------------------------------------------------------------- */
/* Server Startup & Graceful Shutdown                                         */
/* -------------------------------------------------------------------------- */

const isDirectRun = process.argv[1]?.includes('server.ts') || process.argv[1]?.includes('server.js');
let server: any = null;

if (isDirectRun) {
  const PORT = mcpConfig.port;
  server = app.listen(PORT, () => {
    console.log(` Karma MCP Server running on port ${PORT}`);
    console.log(` Streamable HTTP: http://localhost:${PORT}/mcp`);
    console.log(` SSE Fallback:    http://localhost:${PORT}/sse`);
    console.log(` Health Check:    http://localhost:${PORT}/health`);
  });

  const shutdown = () => {
    console.log('Shutting down Karma MCP server...');
    if (server) {
      server.close(() => {
        console.log('MCP HTTP server closed.');
        process.exit(0);
      });
    }
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default app;
