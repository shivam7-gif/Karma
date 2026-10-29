# Karma Architecture

Source-backed diagrams for interviewers. Component names match the code.

## High-level request flow

```mermaid
flowchart TD
  subgraph ClientUI ["Client / UI"]
    Browser["React SPA - Dashboard ChatView"]
  end

  subgraph ApiAgent ["API and agent orchestration"]
    Express["Express app - src/index.ts"]
    ChatRoute["chatRouter - POST /api/chat"]
    Prompt["buildSystemPrompt"]
    Loop["Tool-call loop - max 5 iterations"]
    Orch["orchestrator.execute - complex prompts only"]
    McpClient["mcpManager - mcp/client.ts"]
  end

  subgraph LlmProviders ["LLM providers"]
    Groq["groqProvider"]
    OpenRouter["openRouterProvider"]
  end

  subgraph McpLayer ["MCP server and tool registry"]
    McpHttp["McpServer Streamable HTTP /mcp"]
    Tools["createMcpServer tools"]
  end

  subgraph WorkRag ["Repository workspace and RAG"]
    CodeWs[".karma-workspaces or tmp - registerCodeTools"]
    Neo4j["Neo4j Aura - rag/store.ts"]
  end

  subgraph DataExt ["Database and external services"]
    Neon["Neon Postgres - conversations messages users secrets"]
    GitHub["Public GitHub git clone --depth=1"]
    GroqApi["Groq API"]
    OrApi["OpenRouter API"]
  end

  Browser -->|"HTTP SSE POST /api/chat"| ChatRoute
  ChatRoute --> Express
  ChatRoute --> Prompt
  ChatRoute -->|"SQL"| Neon
  ChatRoute -->|"isComplexPrompt"| Orch
  ChatRoute --> Loop
  Loop -->|"stream messages plus tools"| Groq
  Loop -->|"stream if no GROQ_API_KEY"| OpenRouter
  Groq --> GroqApi
  OpenRouter --> OrApi
  Loop -->|"getLLMTools / executeTool"| McpClient
  McpClient -->|"MCP Streamable HTTP"| McpHttp
  McpHttp --> Tools
  Tools -->|"code_*"| CodeWs
  Tools -->|"knowledge_retrieval rag_ingest list_documents"| Neo4j
  CodeWs -->|"git clone"| GitHub
```

## LLM-to-MCP tool-calling sequence

Implemented in `backend/src/routes/chat.routes.ts` (`MAX_TOOL_ITERATIONS = 5`).

```mermaid
sequenceDiagram
  participant User
  participant FE as ChatView / sendMessage
  participant API as POST /api/chat
  participant LLM as Groq or OpenRouter
  participant MCP as mcpManager
  participant Srv as McpServer tool handler

  User->>FE: Submit prompt
  FE->>API: SSE POST message plus conversationId
  API->>API: Load history from Neon
  API->>MCP: getLLMTools
  alt MCP HTTP reachable
    MCP->>Srv: listTools
    Srv-->>MCP: tool definitions
  else MCP HTTP unreachable
    MCP-->>API: in-process fallback tool list
  end
  MCP-->>API: LLMToolDefinition array

  alt No-tool path
    API->>LLM: stream without needing a tool result
    LLM-->>API: text deltas only
    API-->>FE: SSE delta
  else Tool-call loop max 5
    loop Until no tool_call or 5 iterations
      API->>LLM: stream messages plus tools
      LLM-->>API: text and or tool_call
      API-->>FE: SSE delta and tool_call
      API->>MCP: executeTool name args
      MCP->>Srv: callTool or local handler
      alt Tool error or timeout
        Srv-->>MCP: error text
        MCP-->>API: success false
      else Tool success
        Srv-->>MCP: result text
        MCP-->>API: ToolExecutionResult
      end
      API-->>FE: SSE tool_result
      API->>API: Append tool result to conversationContext
    end
  end

  API->>API: Persist assistant message
  API-->>FE: SSE done
  FE-->>User: Rendered Markdown
```

Direct-intent shortcuts exist before this loop: Amazon (`shop_amazon`) and app-builder (`build_external_app`) can short-circuit without the LLM tool loop.

## GitHub inspection and proposed-edit safety

Implemented in `backend/mcp/tools/code/registerCodeTools.ts`. Approval is conversational: the model is instructed to call `code_apply_proposal` only after the user agrees. There is no separate UI approval gate for code edits. Changes are never pushed to GitHub.

```mermaid
flowchart TD
  A["User supplies github.com URL"] --> B["parseGitHubUrl"]
  B --> C{"https github.com owner/repo?"}
  C -->|No| D["Error returned to LLM"]
  C -->|Yes| E["git clone --depth=1 into isolated workspace"]
  E --> F["Inspection: list read search git status git diff"]
  F --> G["code_propose_edit"]
  G --> H["Diff stored in memory - file unchanged"]
  H --> I{"User asks to apply?"}
  I -->|No| J["Proposal unused - files unchanged"]
  I -->|Yes| K["code_apply_proposal"]
  K --> L["Write file in workspace only"]
  L --> M["Remote GitHub not modified - no git push"]
```
