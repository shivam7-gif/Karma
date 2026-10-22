import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  vector,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/* -------------------------------------------------------------------------- */
/* 1. Users                                                                   */
/* -------------------------------------------------------------------------- */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').unique(),
    locale: text('locale').notNull().default('en-US'),
    timezone: text('timezone').notNull().default('UTC'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('users_email_idx').on(table.email),
  ]
);

/* -------------------------------------------------------------------------- */
/* 2. User Secrets (Encrypted at Rest)                                        */
/* -------------------------------------------------------------------------- */
export const userSecrets = pgTable(
  'user_secrets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    keyType: text('key_type').notNull(), // 'openrouter_api_key'
    encryptedValue: text('encrypted_value').notNull(),
    iv: text('iv').notNull(),
    tag: text('tag').notNull(),
    last4: text('last4').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('user_secrets_user_idx').on(table.userId),
    uniqueIndex('user_secrets_user_key_idx').on(table.userId, table.keyType),
  ]
);

/* -------------------------------------------------------------------------- */
/* 3. User Settings                                                           */
/* -------------------------------------------------------------------------- */
export const userSettings = pgTable(
  'user_settings',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    defaultModel: text('default_model'),
    fallbackModels: jsonb('fallback_models').$type<string[]>().default([]),
    browserAllowedDomains: jsonb('browser_allowed_domains').$type<string[]>().default([]),
    voicePrefs: jsonb('voice_prefs').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('user_settings_user_idx').on(table.userId),
  ]
);

/* -------------------------------------------------------------------------- */
/* 4. Conversations & Messages                                                */
/* -------------------------------------------------------------------------- */
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('New Conversation'),
    rollingSummary: text('rolling_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('conversations_user_idx').on(table.userId),
  ]
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    role: text('role').notNull(), // 'user' | 'assistant' | 'system'
    content: text('content').notNull(),
    parts: jsonb('parts').$type<unknown[]>().default([]),
    status: text('status').notNull().default('complete'), // 'streaming'|'complete'|'stopped'|'error'
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    modelUsed: text('model_used'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('messages_conv_created_idx').on(table.conversationId, table.createdAt),
    index('messages_parent_idx').on(table.parentId),
  ]
);

/* -------------------------------------------------------------------------- */
/* 5. Trace Steps (Tree of execution)                                         */
/* -------------------------------------------------------------------------- */
export const traceSteps = pgTable(
  'trace_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    parentStepId: uuid('parent_step_id'),
    stepType: text('step_type').notNull(), // 'model_call' | 'tool_call' | 'browser_action'
    name: text('name').notNull(),
    inputs: jsonb('inputs'),
    outputs: jsonb('outputs'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    latencyMs: integer('latency_ms').notNull().default(0),
    tokensUsed: integer('tokens_used'),
    model: text('model'),
    error: text('error'),
    status: text('status').notNull().default('running'), // 'running' | 'completed' | 'failed'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('trace_steps_message_idx').on(table.messageId),
    index('trace_steps_parent_idx').on(table.parentStepId),
  ]
);

/* -------------------------------------------------------------------------- */
/* 6. Confirmations Gatekeeper                                                */
/* -------------------------------------------------------------------------- */
export const confirmations = pgTable(
  'confirmations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
    actionType: text('action_type').notNull(), // 'purchase' | 'delete_event' | 'calendar_write'
    description: text('description').notNull(),
    payload: jsonb('payload').notNull(),
    payloadHash: text('payload_hash').notNull(), // SHA-256 bound check
    status: text('status').notNull().default('pending'), // 'pending' | 'confirmed' | 'cancelled' | 'expired'
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('confirmations_user_idx').on(table.userId),
    index('confirmations_status_idx').on(table.status),
  ]
);

/* -------------------------------------------------------------------------- */
/* 7. Tasks & Calendar Events                                                 */
/* -------------------------------------------------------------------------- */
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listId: text('list_id').notNull().default('default'),
    title: text('title').notNull(),
    completed: boolean('completed').notNull().default(false),
    dueDate: timestamp('due_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tasks_user_filter_idx').on(table.userId, table.completed, table.dueDate),
  ]
);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    location: text('location'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('events_user_time_idx').on(table.userId, table.startTime),
  ]
);

/* -------------------------------------------------------------------------- */
/* 8. Long-term Memories                                                      */
/* -------------------------------------------------------------------------- */
export const memories = pgTable(
  'memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: text('category').notNull().default('preference'), // 'preference'|'fact'|'work'
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('memories_user_idx').on(table.userId),
  ]
);

/* -------------------------------------------------------------------------- */
/* 9. Documents & pgvector Chunks                                             */
/* -------------------------------------------------------------------------- */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    fileType: text('file_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('documents_user_idx').on(table.userId),
  ]
);

export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  },
  (table) => [
    index('document_chunks_doc_idx').on(table.documentId),
    index('document_chunks_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ]
);

/* -------------------------------------------------------------------------- */
/* 10. MCP Servers                                                            */
/* -------------------------------------------------------------------------- */
export const mcpServers = pgTable(
  'mcp_servers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    transport: text('transport').notNull(), // 'stdio' | 'sse' | 'http'
    config: jsonb('config').notNull(), // Encrypted connection settings
    enabled: boolean('enabled').notNull().default(true),
    lastStatus: text('last_status'),
    lastError: text('last_error'),
    lastConnectedAt: timestamp('last_connected_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('mcp_servers_user_idx').on(table.userId),
  ]
);

/* -------------------------------------------------------------------------- */
/* 11. Multi-Agent Orchestrator Tasks                                         */
/* -------------------------------------------------------------------------- */
export const orchestratorTasks = pgTable(
  'orchestrator_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: text('task_id').notNull(),
    sessionId: text('session_id').notNull(),
    parentTaskId: text('parent_task_id'),
    agentType: text('agent_type').notNull(), // 'research' | 'browser' | 'coding' | 'analysis' | 'synthesis'
    description: text('description').notNull(),
    status: text('status').notNull().default('queued'), // 'queued'|'planning'|'running'|'waiting'|'completed'|'failed'|'cancelled'
    dependencies: jsonb('dependencies').$type<string[]>().default([]),
    result: text('result'),
    error: text('error'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('orchestrator_tasks_session_idx').on(table.sessionId),
    index('orchestrator_tasks_status_idx').on(table.status),
    uniqueIndex('orchestrator_tasks_session_task_idx').on(table.sessionId, table.taskId),
  ]
);

