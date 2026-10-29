import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  
  // Database connection strings (Neon Postgres)
  DATABASE_URL: z.string().min(1, {
    message:
      'Missing DATABASE_URL. Please provide your Neon pooled connection string in .env (Neon Console -> Project -> Dashboard -> Connect -> Pooled connection).',
  }),
  DATABASE_URL_UNPOOLED: z.string().optional(),

  // Encryption at rest master key (32 bytes = 64 hex characters, or 32-char string)
  SECRETS_MASTER_KEY: z.string().min(16, {
    message: 'SECRETS_MASTER_KEY must be configured (run: openssl rand -hex 32).',
  }),

  // Optional server-level OpenRouter fallback key
  OPENROUTER_FALLBACK_KEY: z.string().optional(),

  // Vector embedding dimensions (default: 1536 for OpenAI/Titan/Nomic standard)
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),

  APP_NAME: z.string().default('Karma'),
});

let parsedConfig: z.infer<typeof envSchema>;

try {
  // If in test environment without DB, allow lazy evaluation or fallback
  if (process.env.NODE_ENV === 'test' && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/test';
    process.env.SECRETS_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  }

  parsedConfig = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Configuration error in environment variables:');
    for (const issue of error.issues) {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    }
  } else {
    console.error('Failed to load configuration:', error);
  }
  process.exit(1);
}

export const config = parsedConfig;
