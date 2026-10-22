import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

// Migrations MUST run against the unpooled (direct) connection string
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString,
  },
  verbose: true,
  strict: true,
});
