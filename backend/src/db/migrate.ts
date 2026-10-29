import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveMigrationsFolder(): string {
  const candidates = [
    path.join(__dirname, 'migrations'),
    path.resolve(process.cwd(), 'src/db/migrations'),
    path.resolve(process.cwd(), 'db/migrations'),
  ];
  const found = candidates.find((dir) => fs.existsSync(path.join(dir, 'meta', '_journal.json')));
  if (!found) {
    throw new Error(
      `Could not find Drizzle migrations folder. Looked in: ${candidates.join(', ')}`
    );
  }
  return found;
}

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Missing DATABASE_URL_UNPOOLED (or DATABASE_URL) for migrations.');
    console.error('Please configure your Neon direct connection string in backend/.env.');
    process.exit(1);
  }

  console.log('Connecting to the direct database for migrations...');
  const migrationClient = postgres(connectionString, {
    ssl: 'require',
    max: 1,
    connect_timeout: 10,
  });

  try {
    console.log('Enabling pgvector extension...');
    await migrationClient`CREATE EXTENSION IF NOT EXISTS vector;`;

    console.log('Running Drizzle migrations...');
    const db = drizzle(migrationClient);
    const migrationsFolder = resolveMigrationsFolder();

    await migrate(db, { migrationsFolder });
    console.log('All migrations applied successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
