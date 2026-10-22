import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Missing DATABASE_URL_UNPOOLED (or DATABASE_URL) for migrations.');
    console.error('Please configure your Neon direct connection string in backend/.env.');
    process.exit(1);
  }

  console.log('⚡ Connecting to direct database for migrations...');
  const migrationClient = postgres(connectionString, {
    ssl: 'require',
    max: 1,
    connect_timeout: 10,
  });

  try {
    // 1. Ensure pgvector extension is enabled
    console.log('📦 Enabling pgvector extension...');
    await migrationClient`CREATE EXTENSION IF NOT EXISTS vector;`;

    // 2. Run Drizzle migrations
    console.log('🚀 Running Drizzle migrations...');
    const db = drizzle(migrationClient);
    const migrationsFolder = path.join(__dirname, 'migrations');

    await migrate(db, { migrationsFolder });
    console.log('✅ All migrations applied successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
