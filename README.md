# Karma AI

**A multi-modal, agentic AI assistant that combines LLM streaming, Model Context Protocol (MCP) tool calling, RAG document intelligence, and autonomous GitHub repository inspection — in a single full-stack TypeScript application.**

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [System Requirements](#system-requirements)
4. [Quick Start](#quick-start)
5. [Architecture](#architecture)
6. [Technology Stack](#technology-stack)
7. [Environment Variables](#environment-variables)
8. [Services and Ports](#services-and-ports)
9. [Installation](#installation)
10. [Database Setup](#database-setup)
11. [Running Locally](#running-locally)
12. [LLM Provider Configuration](#llm-provider-configuration)
13. [Code MCP Workflow](#code-mcp-workflow)
14. [API Reference](#api-reference)
15. [MCP Tool Reference](#mcp-tool-reference)
16. [Testing and Type Checking](#testing-and-type-checking)
17. [Production Build](#production-build)
18. [Deployment Guide (Render)](#deployment-guide-render)
19. [Security](#security)
20. [Troubleshooting](#troubleshooting)
21. [Known Limitations](#known-limitations)
22. [Interview Walkthrough](#interview-walkthrough)

---

## Overview

Karma is a production-quality AI assistant with a React frontend and an Express backend. It supports:

- Streaming LLM responses via **Groq** (free, fast inference) and **OpenRouter** (BYOK, 200+ models).
- A custom **Model Context Protocol (MCP)** server and client that dynamically discover and execute tools.
- **GitHub repository inspection** — clone any public repo, read files, search code, and create reviewable diffs without touching the source until the user explicitly approves.
- **RAG (Retrieval-Augmented Generation)** — ingest PDFs, Markdown, and text files into a vector store (Neo4j Aura or pgvector) and retrieve relevant context.
- **Multi-agent orchestration** — complex prompts are automatically decomposed and routed to specialist agents.
- **Encrypted API key storage** — user OpenRouter keys are AES-256-GCM encrypted at rest in Neon Postgres.
- **Google and GitHub OAuth** — user identity flows through a deterministic UUID mapping.

---

## Features

| Feature | Status |
|---|---|
| Streaming LLM chat (Groq, OpenRouter) | ✅ Implemented |
| MCP server with Streamable HTTP and SSE transports | ✅ Implemented |
| MCP client with in-process fallback (no daemon needed) | ✅ Implemented |
| Code MCP: clone public GitHub repos | ✅ Implemented |
| Code MCP: read files, search, git status/diff | ✅ Implemented |
| Code MCP: propose reviewable diffs | ✅ Implemented |
| Code MCP: apply approved proposals | ✅ Implemented |
| RAG ingestion (PDF, DOCX, TXT, MD) | ✅ Implemented (Neo4j Aura backend) |
| RAG retrieval with ensemble search | ✅ Implemented |
| Document list management | ✅ Implemented |
| Amazon shopping automation (Playwright) | ✅ Implemented (requires Playwright browsers) |
| Multi-agent orchestrator | ✅ Implemented |
| Conversation persistence (Neon Postgres) | ✅ Implemented |
| Encrypted API key storage | ✅ Implemented |
| Google OAuth and GitHub OAuth | ✅ Implemented |
| Email/password auth | ⚠️ Mock (no real password verification) |
| Voice mode | ✅ Implemented (Groq Whisper SSE) |
| Push edits to remote GitHub | ❌ Not implemented (workspace-local only) |
| VSCode extension | ⚠️ Scaffolded, not production-ready |

---

## System Requirements

| Dependency | Minimum Version |
|---|---|
| Node.js | 20 LTS or 22 |
| npm | 10+ |
| Git | 2.30+ (for `code_open_repository`) |
| Neon Postgres | Free tier — requires `pgvector` extension |
| Neo4j Aura | Free tier (optional — for RAG vector store) |
| Groq API key | Free at console.groq.com |
| OpenRouter API key | Optional (BYOK via UI) |

---

## Quick Start

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd ai_eng

# 2. Install backend dependencies
cd backend
npm install

# 3. Set up environment
cp .env.example .env
# Edit backend/.env — add DATABASE_URL, SECRETS_MASTER_KEY, GROQ_API_KEY

# 4. Run migrations
npm run db:migrate

# 5. Start the backend (includes MCP server on same port)
npm run dev

# 6. In a new terminal, install and start the frontend
cd ../frontend/app
npm install
npm run dev
# Open http://localhost:5173
```

---

## Architecture

### High-Level Architecture

```mermaid
flowchart TD
    subgraph Client ["Client / Browser"]
        UI["React SPA\nport 5173 dev / served from backend in prod"]
    end

    subgraph API ["API Server — Express\nport 3001 dev / PORT env in prod"]
        Chat["/api/chat\nSSE Streaming"]
        Settings["/api/settings"]
        Auth["/api/auth/*"]
        Health["/health"]
        MCP_Routes["/mcp /sse /messages\nMCP Streamable HTTP"]
    end

    subgraph Agent ["Agent & Orchestrator"]
        Prompt["buildSystemPrompt()"]
        Loop["Tool-Call Loop\nmax 5 iterations"]
        Orchestrator["Multi-Agent Orchestrator"]
    end

    subgraph LLM ["LLM Providers"]
        Groq["Groq API\nopenai/gpt-oss-120b\nopenai/gpt-oss-20b"]
        OpenRouter["OpenRouter API\n200+ models BYOK"]
    end

    subgraph MCP ["MCP Server & Tools"]
        McpServer["McpServer\n@modelcontextprotocol/sdk"]
        CodeTools["Code Tools\nopen / list / read / search\ngit-status / propose / apply"]
        RAGTools["RAG Tools\ningest / retrieve / list-docs"]
        ShopTools["Shopping Tools\nshop_amazon / search_products"]
        OtherTools["Other Tools\ntravel_planner / manage_lists\nhome_assistant / creative_studio"]
    end

    subgraph Storage ["Storage"]
        Neon["Neon Postgres\nconversations, messages\nusers, secrets, settings\ntrace_steps, confirmations"]
        Neo4j["Neo4j Aura\nRAG vector store\ndocument chunks"]
        Workspace["Local Filesystem\n.karma-workspaces/\ncloned repos — ephemeral"]
    end

    UI -->|"SSE POST /api/chat"| Chat
    UI -->|"REST"| Settings
    UI -->|"REST"| Auth
    Chat --> Prompt
    Chat --> Loop
    Chat --> Orchestrator
    Loop -->|"stream()"| Groq
    Loop -->|"stream()"| OpenRouter
    Loop -->|"executeTool()"| MCP_Routes
    MCP_Routes --> McpServer
    McpServer --> CodeTools
    McpServer --> RAGTools
    McpServer --> ShopTools
    McpServer --> OtherTools
    CodeTools --> Workspace
    RAGTools --> Neo4j
    Chat --> Neon
    Settings --> Neon
```

### LLM Tool-Calling Sequence

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant FE as React Frontend
    participant API as Express API /api/chat
    participant LLM as Groq / OpenRouter
    participant MCP as MCP Client
    participant Tool as Tool Handler

    U->>FE: Types prompt and submits
    FE->>API: POST /api/chat (SSE)
    API->>API: Load conversation history (Neon)
    API->>MCP: getLLMTools() — discover available tools
    MCP-->>API: 19 tool definitions
    API->>LLM: stream(messages, tools)

    loop Tool-Call Loop (max 5 iterations)
        LLM-->>API: delta text events
        API-->>FE: SSE delta events
        LLM-->>API: tool_call event
        API-->>FE: SSE tool_call event
        API->>MCP: executeTool(name, args)
        MCP->>Tool: handler(args)
        Tool-->>MCP: result string
        MCP-->>API: ToolExecutionResult
        API->>LLM: Append tool result to context
        API->>LLM: stream(updated context)
    end

    LLM-->>API: Final text response (no tool_call)
    API-->>FE: SSE delta stream
    API->>API: Persist assistant message (Neon)
    API-->>FE: SSE done event
    FE-->>U: Rendered Markdown response
```

### GitHub Repository Inspection Workflow

```mermaid
flowchart LR
    A["User prompt:\nInspect github.com/owner/repo"] --> B["LLM calls\ncode_open_repository"]
    B --> C["URL validation\nParseGitHubUrl()"]
    C --> D{"Valid public\nGitHub URL?"}
    D -- No --> E["Error returned\nto LLM → user"]
    D -- Yes --> F["git clone --depth=1\nto .karma-workspaces/repoId"]
    F --> G["Returns repoId\nand commit hash"]
    G --> H["LLM calls\ncode_list_files / code_read_file\ncode_search / code_git_status"]
    H --> I["LLM calls\ncode_propose_edit\nwith new content"]
    I --> J["Diff generated\nin memory — NO file change"]
    J --> K["Proposal shown\nto user in chat"]
    K --> L{"User\napproves?"}
    L -- No --> M["Proposal discarded\nFiles unchanged"]
    L -- Yes --> N["LLM calls\ncode_apply_proposal"]
    N --> O["File written\nin workspace only"]
    O --> P["Remote GitHub\nNOT modified"]
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Zustand, React Router v7, react-markdown, Monaco Editor, Mermaid |
| **Backend** | Node.js 22, TypeScript, Express v5 |
| **LLM Providers** | Groq (gpt-oss-120b, gpt-oss-20b), OpenRouter (BYOK, 200+ models) |
| **MCP** | `@modelcontextprotocol/sdk` — McpServer, McpClient, Streamable HTTP + SSE transports |
| **Database** | Neon (Postgres 16 + pgvector), Drizzle ORM |
| **RAG Vector Store** | Neo4j Aura (vector similarity search), `@langchain/classic` ensemble retriever |
| **Embeddings** | `@xenova/transformers` — `all-MiniLM-L6-v2` (384-dim, runs locally) |
| **Agent Framework** | Custom orchestrator + LangGraph (`@langchain/langgraph`) |
| **Automation** | Playwright (Amazon shopping workflow) |
| **Logging** | Pino (structured JSON) |
| **Encryption** | Node.js crypto — AES-256-GCM for API key storage |
| **Auth** | Custom Bearer token middleware + Google OAuth + GitHub OAuth |
| **Testing** | Vitest |
| **Deployment** | Render (static site + web service) |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description | Example Placeholder |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Pooled Neon Postgres connection string | `postgresql://user:pass@ep-name-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `DATABASE_URL_UNPOOLED` | ✅ (migrations) | Direct Neon Postgres (used by drizzle-kit) | `postgresql://user:pass@ep-name.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `SECRETS_MASTER_KEY` | ✅ | 64-char hex key for AES-256-GCM encryption | `openssl rand -hex 32` |
| `GROQ_API_KEY` | ✅ | Groq API key (starts with `gsk_`) | `gsk_yourkey` |
| `GROQ_MODEL` | Optional | Default Groq model | `openai/gpt-oss-20b` |
| `OPENROUTER_FALLBACK_KEY` | Optional | Server-side OpenRouter fallback key | `sk-or-v1-...` |
| `PORT` | Optional | HTTP port (default 3001) | `3001` |
| `NODE_ENV` | Optional | `development` or `production` | `production` |
| `FRONTEND_URL` | Optional | CORS allowed origin | `https://karma-web.onrender.com` |
| `NEO4J_URI` | Optional | Neo4j Aura connection URI | `neo4j+s://xxxxxxxx.databases.neo4j.io` |
| `NEO4J_USER` | Optional | Neo4j username (Aura: instance ID) | `03352133` |
| `NEO4J_PASSWORD` | Optional | Neo4j password | `your_neo4j_password` |
| `SERPAPI_KEY` | Optional | SerpAPI key for Google Shopping | `your_serpapi_key` |
| `KARMA_CODE_WORKSPACE_ROOT` | Optional | Local path for cloned repos | `./.karma-workspaces` |
| `MCP_PORT` | Optional | MCP server port (shares backend port) | `3001` |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID | `xxxxxxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth client secret | `GOCSPX-...` |
| `GITHUB_CLIENT_ID` | Optional | GitHub OAuth app client ID | `Ov23li...` |
| `GITHUB_CLIENT_SECRET` | Optional | GitHub OAuth app client secret | `your_github_secret` |
| `MANUS_API_KEY` | Optional | Manus AI app builder API key | `manus_...` |

### Frontend (`frontend/app/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_ENDPOINT` | Optional | Backend chat endpoint (default `/api/chat`) |
| `VITE_USE_MOCK` | Optional | `true` to use mock responses without a backend |
| `VITE_GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID for frontend |
| `VITE_GITHUB_CLIENT_ID` | Optional | GitHub OAuth client ID for frontend |

---

## Services and Ports

| Service | Dev Port | Command |
|---|---|---|
| Frontend (Vite dev server) | 5173 | `cd frontend/app && npm run dev` |
| Backend API + MCP (combined) | 3001 | `cd backend && npm run dev` |
| Database (Neon — remote) | N/A | Cloud only |
| Neo4j Aura (remote) | N/A | Cloud only |

In production, the backend serves the built frontend SPA from `../frontend/app/dist` at the same port.

---

## Installation

### Prerequisites

```powershell
# Verify tools
node --version   # Must be >= 20
git --version    # Must be >= 2.30
```

### Backend Setup

```powershell
cd backend
npm install
cp .env.example .env
# Edit backend/.env with your credentials
```

### Frontend Setup

```powershell
cd frontend/app
npm install
cp .env.example .env
# Set VITE_USE_MOCK=false to connect to a real backend
```

---

## Database Setup

Karma uses **Neon Postgres** with Drizzle ORM. You need:

1. A free Neon account at [neon.tech](https://neon.tech).
2. The `pgvector` extension enabled (Neon enables it automatically).
3. Your connection strings in `backend/.env`.

**Run migrations** (one-time setup, safe to re-run):

```powershell
cd backend
npm run db:migrate
```

This runs [`src/db/migrate.ts`](backend/src/db/migrate.ts) which applies SQL migrations from `src/db/migrations/` using the `DATABASE_URL_UNPOOLED` (direct connection).

> [!IMPORTANT]
> Use `DATABASE_URL_UNPOOLED` (direct, not pooled) for migrations. Use `DATABASE_URL` (pooled) for the running application.

---

## Running Locally

```powershell
# Terminal 1 — Backend (API + MCP combined)
cd backend
npm run dev
# → http://localhost:3001

# Terminal 2 — Frontend
cd frontend/app
npm run dev
# → http://localhost:5173
```

The frontend Vite proxy forwards `/api/*` to `http://localhost:3001`.

---

## LLM Provider Configuration

### Groq (Free — Recommended for demos)

1. Create an account at [console.groq.com](https://console.groq.com).
2. Generate an API key (starts with `gsk_`).
3. Set `GROQ_API_KEY=gsk_yourkey` in `backend/.env`.
4. Set `GROQ_MODEL=openai/gpt-oss-20b` or `openai/gpt-oss-120b`.

> [!NOTE]
> Groq free tier has rate limits. If you see **429**, switch the model or wait a minute. `openai/gpt-oss-120b` has higher limits than `openai/gpt-oss-20b`.

### OpenRouter (BYOK — supports 200+ models)

1. Create an account at [openrouter.ai](https://openrouter.ai).
2. Generate an API key (starts with `sk-or-v1-`).
3. Either set `OPENROUTER_FALLBACK_KEY` in `backend/.env`, or paste the key in the **Settings** panel inside the app UI.

---

## Code MCP Workflow

The Code MCP system allows Karma to inspect and propose changes to any public GitHub repository.

### Example Prompts

**Inspect a repo:**
```
Open https://github.com/octocat/Hello-World, list its files, read the README, and describe what the repo does.
```

**Propose an edit:**
```
Open https://github.com/octocat/Hello-World, read the README, and propose an improved version with a Getting Started section. Show me the diff.
```

**Apply approved changes:**
```
The diff looks good, please apply this proposal.
```

### How It Works

1. `code_open_repository` — validates the GitHub URL, runs `git clone --depth=1` into `.karma-workspaces/<uuid>/`.
2. `code_list_files` / `code_read_file` / `code_search` — read-only inspection of the workspace.
3. `code_propose_edit` — generates a unified diff and stores a `proposalId`. **No files are modified.**
4. User reviews the diff in the chat.
5. `code_apply_proposal` — writes the new content to the workspace file only after explicit user approval.

> [!IMPORTANT]
> Changes are **never** pushed to GitHub. The workspace is local and ephemeral. On ephemeral (Render free tier) deployments, workspaces are lost on restart.

---

## API Reference

All endpoints require an `Authorization: Bearer <userId>` header or `x-user-id` header. In local development, auth defaults to a test user.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Database health check |
| `POST` | `/api/chat` | Bearer | Main SSE streaming chat endpoint |
| `GET` | `/api/settings` | Bearer | Get user settings and API key status |
| `PUT` | `/api/settings/llm-key` | Bearer | Save encrypted OpenRouter key |
| `DELETE` | `/api/settings/llm-key` | Bearer | Delete stored key |
| `POST` | `/api/settings/llm-key/test` | Bearer | Test a key before saving |
| `PATCH` | `/api/settings` | Bearer | Update model or domain preferences |
| `GET` | `/api/settings/models` | Bearer | List available OpenRouter models |
| `GET` | `/api/auth/config` | None | Return OAuth client IDs for frontend |
| `POST` | `/api/auth/github` | None | Exchange GitHub OAuth code for user info |
| `POST` | `/api/auth/google` | None | Exchange Google OAuth token for user info |
| `POST` | `/api/auth/login` | None | Mock email/password login |
| `POST` | `/api/auth/signup` | None | Mock email/password signup |
| `POST` | `/mcp` | None | MCP Streamable HTTP endpoint |
| `GET` | `/sse` | None | MCP SSE transport endpoint |
| `POST` | `/messages` | None | MCP SSE message handler |

### Chat Endpoint

```http
POST /api/chat
Authorization: Bearer <userId>
Content-Type: application/json

{
  "message": "Open https://github.com/octocat/Hello-World and read the README",
  "conversationId": "optional-uuid",
  "model": "openai/gpt-oss-20b"
}
```

Response: Server-Sent Events stream with event types:
- `{"type":"delta","text":"...","seq":1}` — text chunk
- `{"type":"tool_call","id":"...","name":"code_open_repository","args":{...}}` — tool invocation
- `{"type":"tool_result","id":"...","name":"...","result":"..."}` — tool output
- `{"type":"lifecycle","status":"thinking|executing_tool|completed","message":"..."}` — agent lifecycle
- `{"type":"done","conversationId":"...","messageId":"..."}` — completion
- `{"type":"error","error":"..."}` — error

---

## MCP Tool Reference

| Tool | Description | Arguments | Side Effects |
|---|---|---|---|
| `code_open_repository` | Clone a public GitHub repo | `repositoryUrl` | Creates workspace directory |
| `code_list_files` | List files in a cloned repo | `repoId`, `path?` | Read-only |
| `code_read_file` | Read a file from a cloned repo | `repoId`, `filePath` | Read-only |
| `code_search` | Search text in repo files | `repoId`, `query`, `maxResults?` | Read-only |
| `code_git_status` | Git status of a cloned repo | `repoId` | Read-only |
| `code_git_diff` | Git diff of a cloned repo | `repoId` | Read-only |
| `code_propose_edit` | Create a reviewable diff proposal | `repoId`, `filePath`, `proposedContent` | Stores proposal in memory only |
| `code_apply_proposal` | Apply an approved proposal | `proposalId` | **Writes file in workspace** |
| `knowledge_retrieval` | RAG retrieval from knowledge base | `subject`, `depth?` | Read-only |
| `list_documents` | List documents in knowledge base | none | Read-only |
| `rag_ingest` | Ingest a document into Neo4j | `file_path` or `content` | Writes to Neo4j |
| `shop_amazon` | Search Amazon.in and add to cart | `query`, `maxPriceINR?` | Playwright browser automation |
| `search_products` | Search products with price filter | `query`, `maxPriceINR?` | External SerpAPI call |
| `travel_planner` | Generate travel itineraries | `destination_query`, `mode?` | In-process, no external calls |
| `manage_lists` | Query personal lists | `action`, `filter?` | In-process mock |
| `home_assistant_core` | Smart device commands | `query`, `device?`, `state?` | In-process mock |
| `creative_studio` | Generate creative outlines | `prompt`, `style?` | In-process |
| `maps_search` | Resolve places/routes | `query`, `location?` | In-process |
| `build_external_app` | Delegate to Manus/Replit | `prompt`, `provider?` | External API call |

---

## Testing and Type Checking

```powershell
cd backend

# Type check (no emit)
npx tsc -p tsconfig.json --noEmit

# Run all tests
npm test

# Run a specific test file
npx vitest run mcp/rag/store.test.ts

# Frontend type check
cd ../frontend/app
npx tsc -b
```

---

## Production Build

```powershell
# Build frontend first
cd frontend/app
npm run build
# → frontend/app/dist/

# Build backend (TypeScript → JavaScript)
cd ../../backend
npm run build
# → backend/dist/

# Start production server
npm start
# Serves API on PORT (default 3001) + serves frontend/app/dist as SPA
```

---

## Deployment Guide (Render)

The project ships with a `render.yaml` at the repository root.

### Services

| Service | Type | Root Directory | Build | Start |
|---|---|---|---|---|
| `karma-web` | Static Site | `frontend/app` | `npm install && npm run build` | — |
| `karma-api` | Web Service | `backend` | `npm install --include=dev && npm run build` | `npm start` |

### Environment Variables to Set on Render (karma-api)

Set these under the `karma-api` service **Environment** tab:

```
DATABASE_URL             = <pooled Neon connection string>
DATABASE_URL_UNPOOLED    = <direct Neon connection string>
SECRETS_MASTER_KEY       = <64-char hex key>
GROQ_API_KEY             = <gsk_...>
GROQ_MODEL               = openai/gpt-oss-20b
FRONTEND_URL             = <https://karma-web.onrender.com or your custom domain>
NODE_ENV                 = production
PORT                     = 10000
NEO4J_URI                = <neo4j+s://...>
NEO4J_USER               = <instance-id>
NEO4J_PASSWORD           = <password>
```

### Deployment Steps

1. Push the repository to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Blueprint**.
3. Connect your GitHub repository.
4. Render reads `render.yaml` and creates both services automatically.
5. Set the secret environment variables for `karma-api` in the Render dashboard.
6. Under `karma-web`, set `VITE_API_ENDPOINT` to `https://karma-api.onrender.com/api/chat`.
7. Trigger a deploy.
8. Verify: `GET https://karma-api.onrender.com/health` should return `{"status":"ok"}`.

> [!CAUTION]
> Render free tier has **ephemeral storage** — cloned repository workspaces (`.karma-workspaces/`) are lost on restart. Code MCP tools work but workspaces do not persist across deploys. For persistent workspaces, upgrade to Render's paid tier or use a mounted disk.

### Running Migrations on Render

Migrations are **not** run automatically on startup. Run them once manually:

```bash
# From Render Shell or locally against the Neon database
DATABASE_URL_UNPOOLED=<your-direct-url> node -e "import('./dist/db/migrate.js')"
```

Or use the Render Shell on the `karma-api` service after the first deploy.

---

## Security

| Concern | Implementation |
|---|---|
| API keys at rest | AES-256-GCM encrypted in Postgres, never returned in plaintext |
| API keys in transit | HTTPS only, never logged |
| Path traversal in repo workspace | `safeFilePath()` resolves and validates all paths within `repo.root` |
| Repository URL validation | `parseGitHubUrl()` validates scheme, host (`github.com`), and owner/repo format |
| Arbitrary code execution | Repos are cloned but no code is executed from them |
| File size limits | `MAX_FILE_BYTES = 200 KB` per file, `MAX_FILES = 3000` per repo |
| Consequential tool safety gate | `shop_amazon`, `manage_lists`, `home_assistant_core`, `rag_ingest` require confirmation |
| CORS | Allowlist: localhost + `.onrender.com` + `FRONTEND_URL` env var |
| Auth in production | Bearer token required; dev-mode default user only active when `NODE_ENV !== production` |
| Secrets in logs | Pino logger does not log `DATABASE_URL`, `GROQ_API_KEY`, or `SECRETS_MASTER_KEY` |
| GitHub push | Not implemented — workspace changes are never pushed |

> [!WARNING]
> The email/password auth (`/api/auth/login`, `/api/auth/signup`) is a mock that accepts any email without verification. Do not expose this to production users without replacing it with a real auth system.

---

## Troubleshooting

### 429 Rate Limit from Groq

Switch to a model with higher limits:

```env
GROQ_MODEL=openai/gpt-oss-120b
```

Or wait 60 seconds and retry. The free tier resets per minute.

### Database Connection Fails on Startup

- Verify `DATABASE_URL` is the **pooled** Neon connection string (contains `-pooler` in the host).
- Verify `sslmode=require` is present in the connection string.
- Check the Neon console to confirm the project is active.

### MCP Server Tools Not Discovered

The MCP server runs on the same port as the API (`/mcp` endpoint). If the backend is offline, the client automatically falls back to in-process tool execution. No separate daemon is needed for core functionality.

### `code_open_repository` Fails — Git Clone Error

- Verify `git` is installed and accessible in `PATH`.
- Confirm the URL is a **public** GitHub repository.
- The `KARMA_CODE_WORKSPACE_ROOT` directory must be writable.

### `neo4j` Connection Refused

- Neo4j Aura Free tier pauses after 3 days of inactivity. Resume it in the Aura console.
- Verify `NEO4J_USER` is the **instance ID**, not `neo4j`.

### Frontend Cannot Reach Backend

- In development: verify the Vite proxy in `frontend/app/vite.config.ts` targets `http://localhost:3001`.
- In production: verify `VITE_API_ENDPOINT` points to the correct backend URL.

---

## Known Limitations

1. **Groq rate limits** — Free models (`openai/gpt-oss-20b`) hit per-minute token limits quickly during tool-calling workflows. Use `openai/gpt-oss-120b` for better throughput.
2. **Email/password auth is a mock** — No real password hashing or session management.
3. **Code workspace is ephemeral** — Cloned repositories are not persisted across server restarts on free-tier hosting.
4. **No push to GitHub** — `code_apply_proposal` writes to the local workspace only. Remote GitHub is never modified.
5. **Amazon shopping requires Playwright browsers** — `playwright install chromium` must be run; not practical on free-tier hosting.
6. **VSCode extension** — Scaffolded but not production-tested in this version.
7. **Multi-agent orchestrator** — Complex task decomposition works but is not fully optimized for all prompt types.

---

## Interview Walkthrough

A reproducible demo showing the full Code MCP workflow:

**Step 1: Start the application**
```powershell
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend/app && npm run dev
# Open http://localhost:5173
```

**Step 2: Inspect a public repository**

In the prompt bar, type:
```
Open https://github.com/octocat/Hello-World, list its files, read the README, and tell me what you find.
```

Expected: Karma calls `code_open_repository` (clone), `code_list_files`, `code_read_file`, then summarizes the content.

**Step 3: Propose an edit**
```
Propose an improved README with a proper heading, a description, and a Getting Started section. Show me the unified diff.
```

Expected: Karma calls `code_propose_edit` and streams a unified diff. **No file is written.**

**Step 4: Apply the change**
```
Looks good. Please apply this proposal.
```

Expected: Karma calls `code_apply_proposal`. The file in the workspace is updated. The remote GitHub repository is NOT modified.

**What to highlight to an interviewer:**
- The LLM discovers tools dynamically via MCP (not hardcoded if-else).
- Tool calls are streamed as SSE events visible in the browser network tab.
- The proposal safety boundary — diff shown before any write.
- AES-256-GCM encrypted API key storage in Postgres.
- Typed TypeScript throughout — `npx tsc --noEmit` runs clean.
