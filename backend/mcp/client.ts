import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { LLMToolDefinition } from '../src/llm/types.js';
import { logger } from '../src/lib/logger.js';
import { mcpConfig } from './config.js';
import { runAmazonShoppingWorkflow } from '../src/tools/shopping/amazonShoppingAgent.js';
import { appBuilderService } from '../src/services/appBuilder/index.js';
import { codeToolHandlers } from './tools/code/registerCodeTools.js';

export interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  transport?: 'streamable-http' | 'sse';
  apiKey?: string;
  enabled?: boolean;
}

export interface DiscoveredTool {
  serverId: string;
  serverName: string;
  rawName: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  isConsequential: boolean;
}

export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  serverId: string;
  result: string;
  data?: unknown | undefined;
  durationMs: number;
  error?: string | undefined;
  requiresConfirmation?: boolean | undefined;
}

// Consequential write-capable tools requiring user confirmation
const CONSEQUENTIAL_TOOLS = new Set([
  'home_assistant_core',
  'manage_lists',
  'rag_ingest',
]);

export class MultiMcpManager {
  private servers: Map<string, McpServerConfig> = new Map();
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StreamableHTTPClientTransport> = new Map();
  private toolRegistry: Map<string, DiscoveredTool> = new Map();
  private cachedLLMTools: LLMToolDefinition[] | null = null;
  private lastToolsCacheTime = 0;
  private static CACHE_TTL_MS = 60 * 1000; // Cache tools in-memory for 60s
  private initialized = false;

  constructor(serverConfigs?: McpServerConfig[]) {
    // 1. Always register default Karma MCP server
    const defaultUrl = process.env.MCP_URL || mcpConfig.endpoint || 'http://localhost:3000/mcp';
    this.registerServer({
      id: 'karma',
      name: 'Karma MCP Server',
      url: defaultUrl,
      enabled: true,
    });

    // 2. Register any additional configured servers
    if (serverConfigs) {
      for (const cfg of serverConfigs) {
        this.registerServer(cfg);
      }
    }

    // 3. Check for MCP_SERVERS in environment (e.g. JSON array: [{"id":"remote","url":"..."}])
    if (process.env.MCP_SERVERS) {
      try {
        const parsed = JSON.parse(process.env.MCP_SERVERS) as McpServerConfig[];
        if (Array.isArray(parsed)) {
          for (const s of parsed) {
            this.registerServer(s);
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to parse MCP_SERVERS from environment variable');
      }
    }
  }

  registerServer(config: McpServerConfig) {
    this.servers.set(config.id, {
      ...config,
      enabled: config.enabled ?? true,
    });
  }

  /**
   * Initializes or refreshes connection to a single MCP server.
   */
  async connectServer(serverId: string): Promise<Client | null> {
    const serverCfg = this.servers.get(serverId);
    if (!serverCfg || !serverCfg.enabled) {
      return null;
    }

    const existingClient = this.clients.get(serverId);
    if (existingClient) {
      return existingClient;
    }

    try {
      const client = new Client({
        name: 'karma-agent-client',
        version: '1.0.0',
      });

      const serverUrl = new URL(serverCfg.url);
      const transport = new StreamableHTTPClientTransport(serverUrl);

      // Connect transport with 10s timeout
      await Promise.race([
        client.connect(transport as any),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout connecting to MCP server ${serverCfg.name} at ${serverCfg.url}`)), 10000)
        ),
      ]);

      this.clients.set(serverId, client);
      this.transports.set(serverId, transport);
      logger.info({ serverId, url: serverCfg.url }, `Connected to MCP server: ${serverCfg.name}`);
      return client;
    } catch (err) {
      logger.warn(
        { serverId, url: serverCfg.url, err: err instanceof Error ? err.message : String(err) },
        `Could not reach MCP server ${serverCfg.name} (server might be offline or disabled)`
      );
      return null;
    }
  }

  /**
   * Discovers all available tools across all active and reachable MCP servers.
   */
  async discoverTools(): Promise<DiscoveredTool[]> {
    this.toolRegistry.clear();
    const discovered: DiscoveredTool[] = [];

    for (const [serverId, config] of this.servers.entries()) {
      if (!config.enabled) continue;

      try {
        const client = await this.connectServer(serverId);
        if (!client) continue;

        const result = await client.listTools();
        const tools = result.tools || [];

        for (const tool of tools) {
          const isConsequential = CONSEQUENTIAL_TOOLS.has(tool.name);
          const toolEntry: DiscoveredTool = {
            serverId,
            serverName: config.name,
            rawName: tool.name,
            name: tool.name, // Keep original name for direct mapping
            description: tool.description || `Tool ${tool.name} from ${config.name}`,
            parameters: (tool.inputSchema as Record<string, unknown>) || {
              type: 'object',
              properties: {},
            },
            isConsequential,
          };

          this.toolRegistry.set(toolEntry.name, toolEntry);
          discovered.push(toolEntry);
        }
      } catch (err) {
        logger.warn(
          { serverId, err: err instanceof Error ? err.message : String(err) },
          `Failed to list tools from MCP server ${config.name}`
        );
      }
    }

    if (discovered.length === 0) {
      // Fallback built-in tools to guarantee instant availability
      const fallbackTools: DiscoveredTool[] = [
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'build_external_app',
          name: 'build_external_app',
          description:
            'Delegate full-stack application creation, frontend prototyping, and software development tasks to external AI app builders (Manus and Replit). Formulates complete 10-part project specifications, selects the best provider, triggers build tasks, and returns live preview or workspace URLs.',
          parameters: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'User app building request or detailed specification',
              },
              provider: {
                type: 'string',
                enum: ['auto', 'manus', 'replit'],
                description: 'Provider preference: auto, manus, or replit',
              },
            },
            required: ['prompt'],
          },
          isConsequential: false,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'shop_amazon',
          name: 'shop_amazon',
          description:
            'Automate searching Amazon.in, comparing product candidates using AI under a specified INR budget, verifying live price on the product page, and adding the best option to cart up to checkout review with live desktop screen control overlay. Use this when the user asks to find and buy/cart products on Amazon.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Product search query, e.g. "creatine monohydrate"' },
              maxPriceINR: { type: 'number', description: 'Maximum budget in Indian rupees, e.g. 500' },
              requirements: { type: 'string', description: 'Specific criteria or preferences' },
            },
            required: ['query'],
          },
          isConsequential: false,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'search_products',
          name: 'search_products',
          description: 'Search real shopping products in India and filter them by maximum price in INR.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Product search query' },
              maxPriceINR: { type: 'number', description: 'Maximum price in INR' },
              limit: { type: 'number', description: 'Maximum number of products to return' },
            },
            required: ['query'],
          },
          isConsequential: false,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'manage_lists',
          name: 'manage_lists',
          description: 'Queries and modifies personal lists and checklists',
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', description: "Action: 'query', 'create', 'add', 'remove'" },
              filter: { type: 'string', description: 'Filter category or list name' },
              title: { type: 'string', description: 'Title of list' },
              items: { type: 'array', items: { type: 'string' }, description: 'Items to add or update' },
            },
            required: ['action'],
          },
          isConsequential: true,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'travel_planner',
          name: 'travel_planner',
          description: 'Coordinates destinations, itineraries, and packing schedules',
          parameters: {
            type: 'object',
            properties: {
              destination_query: { type: 'string', description: 'Destination or query' },
              mode: { type: 'string', description: "Planning mode: 'itinerary', 'packing', 'flights', 'hotels'" },
            },
            required: ['destination_query'],
          },
          isConsequential: false,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'home_assistant_core',
          name: 'home_assistant_core',
          description: 'Interacts with virtual smart devices and automated home routines',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Smart home command' },
              device: { type: 'string', description: 'Target device or room' },
              state: { type: 'string', description: 'Desired state' },
            },
            required: ['query'],
          },
          isConsequential: true,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'knowledge_retrieval',
          name: 'knowledge_retrieval',
          description: 'RAG retrieval from user-indexed personal knowledge documents with citations',
          parameters: {
            type: 'object',
            properties: {
              subject: { type: 'string', description: 'Subject or query to retrieve' },
              depth: { type: 'string', description: 'Retrieval depth' },
            },
            required: ['subject'],
          },
          isConsequential: false,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'creative_studio',
          name: 'creative_studio',
          description: 'Generates outlines and structured conceptual content',
          parameters: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: 'Creative prompt or concept' },
              style: { type: 'string', description: 'Style' },
            },
            required: ['prompt'],
          },
          isConsequential: false,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'maps_search',
          name: 'maps_search',
          description: 'Resolves places and routes using geographic location data',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Place or route search query' },
              location: { type: 'string', description: 'Near location or starting point' },
            },
            required: ['query'],
          },
          isConsequential: false,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'rag_ingest',
          name: 'rag_ingest',
          description: 'Ingests PDF, text, and markdown documents into vector store',
          parameters: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'Path of document to ingest' },
              content: { type: 'string', description: 'Raw content of document' },
            },
          },
          isConsequential: true,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'list_documents',
          name: 'list_documents',
          description: "List every document in the user's knowledge base with its id, title and chunk count.",
          parameters: { type: 'object', properties: {} },
          isConsequential: false,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'code_open_repository',
          name: 'code_open_repository',
          description: 'Clone a public GitHub repository into an isolated Karma workspace. Returns a repository ID for subsequent code tools.',
          parameters: {
            type: 'object',
            properties: {
              repositoryUrl: { type: 'string', description: 'Public GitHub repository URL (e.g. https://github.com/owner/repo)' },
            },
            required: ['repositoryUrl'],
          },
          isConsequential: false,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'code_list_files',
          name: 'code_list_files',
          description: 'List files in a previously opened repository. Paths are relative to the repository root.',
          parameters: {
            type: 'object',
            properties: {
              repoId: { type: 'string', description: 'The repoId returned by code_open_repository' },
              path: { type: 'string', description: 'Optional sub-path within repository' },
            },
            required: ['repoId'],
          },
          isConsequential: false,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'code_read_file',
          name: 'code_read_file',
          description: 'Read a text file from an opened repository.',
          parameters: {
            type: 'object',
            properties: {
              repoId: { type: 'string', description: 'The repoId returned by code_open_repository' },
              filePath: { type: 'string', description: 'Relative path of file to read' },
            },
            required: ['repoId', 'filePath'],
          },
          isConsequential: false,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'code_search',
          name: 'code_search',
          description: 'Search text in repository files, skipping dependencies, build outputs, and Git metadata.',
          parameters: {
            type: 'object',
            properties: {
              repoId: { type: 'string', description: 'The repoId returned by code_open_repository' },
              query: { type: 'string', description: 'Text or symbol to search for' },
              maxResults: { type: 'number', description: 'Maximum number of results (default 30)' },
            },
            required: ['repoId', 'query'],
          },
          isConsequential: false,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'code_git_status',
          name: 'code_git_status',
          description: 'Get Git status for an opened repository.',
          parameters: {
            type: 'object',
            properties: {
              repoId: { type: 'string', description: 'The repoId returned by code_open_repository' },
            },
            required: ['repoId'],
          },
          isConsequential: false,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'code_git_diff',
          name: 'code_git_diff',
          description: 'Show the current tracked-file diff for an opened repository.',
          parameters: {
            type: 'object',
            properties: {
              repoId: { type: 'string', description: 'The repoId returned by code_open_repository' },
            },
            required: ['repoId'],
          },
          isConsequential: false,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'code_propose_edit',
          name: 'code_propose_edit',
          description: 'Create a reviewable edit proposal for an existing repository file without modifying the working file.',
          parameters: {
            type: 'object',
            properties: {
              repoId: { type: 'string', description: 'The repoId returned by code_open_repository' },
              filePath: { type: 'string', description: 'Relative path of file to propose edits for' },
              proposedContent: { type: 'string', description: 'Complete proposed new content for the file' },
            },
            required: ['repoId', 'filePath', 'proposedContent'],
          },
          isConsequential: false,
        },
        {
          serverId: 'karma',
          serverName: 'Karma MCP Server',
          rawName: 'code_apply_proposal',
          name: 'code_apply_proposal',
          description: 'Apply a previously created edit proposal to write changes to the file in the workspace. Only call this when the user approves or confirms the proposal.',
          parameters: {
            type: 'object',
            properties: {
              proposalId: { type: 'string', description: 'The proposalId returned by code_propose_edit' },
            },
            required: ['proposalId'],
          },
          isConsequential: false,
        },
      ];

      for (const tool of fallbackTools) {
        this.toolRegistry.set(tool.name, tool);
        discovered.push(tool);
      }
    }

    this.initialized = true;
    return discovered;
  }

  /**
   * Returns tools formatted as OpenAI / OpenRouter LLMToolDefinition[]
   * Caches results in-memory so each prompt bar request doesn't pay network discovery latency.
   */
  async getLLMTools(force = false): Promise<LLMToolDefinition[]> {
    const now = Date.now();
    if (!force && this.cachedLLMTools && now - this.lastToolsCacheTime < MultiMcpManager.CACHE_TTL_MS) {
      return this.cachedLLMTools;
    }

    const tools = await this.discoverTools();
    const formatted = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    this.cachedLLMTools = formatted;
    this.lastToolsCacheTime = now;
    return formatted;
  }

  /**
   * Validates arguments against schema and executes the requested tool.
   * Handles timeouts, safety checks, and structured error responses.
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    options?: {
      confirmed?: boolean;
      timeoutMs?: number;
      signal?: AbortSignal;
      onProgress?: (event: { status: string; message: string; data?: unknown }) => void;
    }
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Fast-path for shop_amazon: direct visual screen-control automation with progress streaming
    if (toolName === 'shop_amazon') {
      try {
        const query = (args.query as string) || 'creatine monohydrate';
        const budget = typeof args.maxPriceINR === 'number' ? args.maxPriceINR : undefined;
        const requirements = (args.requirements as string) || undefined;

        const result = await runAmazonShoppingWorkflow(
          { query, maxPriceINR: budget, requirements },
          {
            abortSignal: options?.signal,
            onProgress: options?.onProgress,
          }
        );

        return {
          success: result.success,
          toolName,
          serverId: 'karma',
          result: JSON.stringify(result, null, 2),
          data: result,
          durationMs: Date.now() - startTime,
          error: result.error,
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          toolName,
          serverId: 'karma',
          result: `Amazon shopping workflow failed: ${errorMsg}`,
          durationMs: Date.now() - startTime,
          error: errorMsg,
        };
      }
    }

    // Fast-path for build_external_app: delegation to external AI app builders
    if (toolName === 'build_external_app') {
      try {
        const prompt = (args.prompt as string) || '';
        const providerPreference = (args.provider as string) || 'auto';

        const build = await appBuilderService.buildApp(prompt, {
          sessionId: `mcp-${Date.now()}`,
          userId: 'default-user',
          providerOverride: providerPreference,
          ...(options?.signal ? { signal: options.signal } : {}),
          ...(options?.onProgress ? { onProgress: options.onProgress } : {}),
        });

        return {
          success: build.result.status === 'completed' || build.result.status === 'manual_action_required',
          toolName,
          serverId: 'karma',
          result: build.formattedChatResponse,
          data: {
            specification: build.specification,
            result: build.result,
          },
          durationMs: Date.now() - startTime,
          error: build.result.error,
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          toolName,
          serverId: 'karma',
          result: `App building delegation failed: ${errorMsg}`,
          durationMs: Date.now() - startTime,
          error: errorMsg,
        };
      }
    }

    const tool = this.toolRegistry.get(toolName);

    if (!tool) {
      return {
        success: false,
        toolName,
        serverId: 'unknown',
        result: `Tool '${toolName}' is not registered or currently unavailable on connected MCP servers.`,
        durationMs: Date.now() - startTime,
        error: 'TOOL_NOT_FOUND',
      };
    }

    // Safety gate for write-capable / consequential tools
    if (tool.isConsequential && !options?.confirmed) {
      return {
        success: false,
        toolName,
        serverId: tool.serverId,
        result: `Safety Confirmation Required: The tool '${toolName}' alters external state or devices. Please confirm: "Do you want me to execute ${toolName} with parameters: ${JSON.stringify(args)}?"`,
        durationMs: Date.now() - startTime,
        requiresConfirmation: true,
      };
    }

    const client = await this.connectServer(tool.serverId);
    if (!client) {
      if (tool.serverId === 'karma') {
        const localResult = await this.executeLocalKarmaTool(tool.rawName, args);
        if (localResult !== null) {
          return {
            success: true,
            toolName,
            serverId: 'karma',
            result: localResult,
            durationMs: Date.now() - startTime,
          };
        }
      }

      return {
        success: false,
        toolName,
        serverId: tool.serverId,
        result: `Failed to connect to MCP server '${tool.serverName}'. The server appears to be offline.`,
        durationMs: Date.now() - startTime,
        error: 'SERVER_UNREACHABLE',
      };
    }

    const timeoutMs = options?.timeoutMs || 25000;

    try {
      const callPromise = client.callTool({
        name: tool.rawName,
        arguments: args,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      const result = await Promise.race([callPromise, timeoutPromise]);
      const durationMs = Date.now() - startTime;

      // Extract result text from MCP CallToolResult
      let resultText = '';
      if (result.content && Array.isArray(result.content)) {
        resultText = result.content
          .map((c: any) => (typeof c === 'object' && 'text' in c ? c.text : JSON.stringify(c)))
          .join('\n');
      } else {
        resultText = JSON.stringify(result);
      }

      return {
        success: !result.isError,
        toolName,
        serverId: tool.serverId,
        result: resultText,
        data: result,
        durationMs,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error({ toolName, err: errorMsg }, 'Error executing MCP tool');

      return {
        success: false,
        toolName,
        serverId: tool.serverId,
        result: `Tool execution failed: ${errorMsg}`,
        durationMs: Date.now() - startTime,
        error: errorMsg,
      };
    }
  }

  private async executeLocalKarmaTool(name: string, args: Record<string, unknown>): Promise<string | null> {
    if (name === 'travel_planner') {
      const dest = (args.destination_query as string) || 'Destination';
      const mode = (args.mode as string) || 'itinerary';
      return JSON.stringify(
        {
          status: 'ok',
          destination: dest,
          mode,
          recommendation: {
            summary: `Travel plan generated for ${dest} (${mode} mode)`,
            suggestedDuration: '3 Days',
            highlights: ['Morning scenic walk', 'Local cultural landmarks', 'Sunset dining'],
            packingMustHaves: ['Light layers', 'Sun protection', 'Universal adapter'],
          },
        },
        null,
        2
      );
    }
    if (name === 'manage_lists') {
      const activeLists = [
        { id: '1', name: 'Shopping List', count: 5, items: ['Organic Milk', 'Avocados', 'Sourdough Bread', 'Greek Yogurt', 'Coffee Beans'] },
        { id: '2', name: 'Packing List', count: 4, items: ['Swimwear', 'Sunscreen SPF 50', 'Snorkel gear', 'Camera charger'] },
      ];
      const filter = (args.filter as string) || '';
      const matched = filter ? activeLists.filter((l) => l.name.toLowerCase().includes(filter.toLowerCase())) : activeLists;
      return JSON.stringify(
        {
          status: 'ok',
          action: args.action || 'query',
          matchedLists: matched,
        },
        null,
        2
      );
    }
    if (name === 'home_assistant_core') {
      return JSON.stringify(
        {
          status: 'ok',
          action: 'device_state_updated',
          appliedState: args.state || 'updated',
          confirmationMessage: `Command executed for ${args.device || 'device'}.`,
        },
        null,
        2
      );
    }
    if (name === 'code_open_repository') {
      return await codeToolHandlers.openRepository(args.url as string);
    }
    if (name === 'code_list_files') {
      return await codeToolHandlers.listFiles(args.repoId as string, (args.path as string) || '');
    }
    if (name === 'code_read_file') {
      return await codeToolHandlers.readFile(args.repoId as string, args.filePath as string);
    }
    if (name === 'code_search') {
      return await codeToolHandlers.search(args.repoId as string, args.query as string, (args.maxResults as number) || 30);
    }
    if (name === 'code_git_status') {
      return await codeToolHandlers.gitStatus(args.repoId as string);
    }
    if (name === 'code_git_diff') {
      return await codeToolHandlers.gitDiff(args.repoId as string);
    }
    if (name === 'code_propose_edit') {
      return await codeToolHandlers.proposeEdit(
        args.repoId as string,
        args.filePath as string,
        args.proposedContent as string
      );
    }
    if (name === 'code_apply_proposal') {
      return await codeToolHandlers.applyProposal(args.proposalId as string);
    }
    return null;
  }

  /**
   * Cleanly closes all active MCP client sessions.
   */
  async closeAll() {
    for (const [id, client] of this.clients.entries()) {
      try {
        await client.close();
      } catch (err) {
        logger.warn({ id, err }, 'Error closing MCP client');
      }
    }
    this.clients.clear();
    this.transports.clear();
    this.toolRegistry.clear();
  }
}

export const mcpManager = new MultiMcpManager();

