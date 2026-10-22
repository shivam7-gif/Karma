import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema.js';
import { logger } from '../lib/logger.js';

let client: postgres.Sql | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Initializes or retrieves the singleton Postgres connection.
 * Handles Neon cold start with connection retries and connect_timeout.
 */
export function getDb() {
  if (dbInstance) return dbInstance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'Missing DATABASE_URL. Please set your Neon pooled connection string in .env (Neon Console -> Project -> Dashboard -> Connect -> Pooled connection).'
    );
  }

  // Neon pooled (PgBouncer) connection setup:
  // - max: 10 connections per container
  // - ssl: require
  // - connect_timeout: 10 seconds
  // - idle_timeout: 20 seconds
  client = postgres(connectionString, {
    ssl: 'require',
    max: 10,
    connect_timeout: 10,
    idle_timeout: 20,
    prepare: false, // PgBouncer transaction pooling does not support named prepared statements
  });

  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

/**
 * Checks connection health with a lightweight `SELECT 1`.
 * Retries up to 3 times to accommodate Neon cold starts.
 */
export async function checkDbHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const db = getDb();
      // Execute raw select 1
      await db.execute(sql`SELECT 1 as alive`);
      return {
        ok: true,
        latencyMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn(`Neon connection attempt ${attempt}/${maxRetries} failed: ${errorMsg}`);
      if (attempt === maxRetries) {
        return {
          ok: false,
          latencyMs: Date.now() - start,
          error: errorMsg,
        };
      }
      // Exponential backoff before retry (300ms, 600ms)
      await new Promise((res) => setTimeout(res, 300 * attempt));
    }
  }

  return {
    ok: false,
    latencyMs: Date.now() - start,
    error: 'Max retries exhausted connecting to database',
  };
}

export const db = getDb();
export * from './schema.js';
