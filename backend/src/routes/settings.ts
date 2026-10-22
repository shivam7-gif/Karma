import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { userSecrets, userSettings, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { encryptSecret, maskSecret } from '../lib/crypto.js';
import { openRouterProvider } from '../llm/openrouter.js';
import { authMiddleware, type AuthenticatedRequest } from '../lib/auth.js';
import { BadRequestError } from '../lib/errors.js';

export const settingsRouter = Router();


// Apply auth middleware to all settings routes
settingsRouter.use(authMiddleware);

// Validation Schemas
const saveKeySchema = z.object({
  apiKey: z.string().min(10, 'API key must be at least 10 characters').startsWith('sk-or-', 'Key must start with sk-or-'),
});

const updateSettingsSchema = z.object({
  defaultModel: z.string().optional(),
  fallbackModels: z.array(z.string()).optional(),
  browserAllowedDomains: z.array(z.string()).optional(),
});

/**
 * Ensure user and default settings exist in DB.
 */
async function ensureUserExists(userId: string) {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!existingUser) {
    await db.insert(users).values({
      id: userId,
      name: 'Shiva',
      email: `${userId}@karma.local`,
    }).onConflictDoNothing();
  }

  const existingSettings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });

  if (!existingSettings) {
    await db.insert(userSettings).values({
      userId,
      defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    }).onConflictDoNothing();
  }
}

/**
 * GET /api/settings
 * Retrieves user settings and key status (showing only last 4 digits).
 */
settingsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  await ensureUserExists(userId);

  const [settings, secret] = await Promise.all([
    db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) }),
    db.query.userSecrets.findFirst({
      where: and(eq(userSecrets.userId, userId), eq(userSecrets.keyType, 'openrouter_api_key')),
    }),
  ]);

  res.json({
    defaultModel: settings?.defaultModel || 'meta-llama/llama-3.3-70b-instruct:free',
    fallbackModels: settings?.fallbackModels || [],
    browserAllowedDomains: settings?.browserAllowedDomains || [],
    hasKey: Boolean(secret),
    keyLast4: secret ? secret.last4 : null,
  });
});

/**
 * PUT /api/settings/llm-key
 * Stores encrypted user API key. NEVER returns plaintext.
 */
settingsRouter.put('/llm-key', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  await ensureUserExists(userId);

  const parsed = saveKeySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('Invalid key payload', parsed.error.issues);
  }

  const { apiKey } = parsed.data;

  // Validate key before saving
  const testResult = await openRouterProvider.testKey(apiKey);
  if (!testResult.valid) {
    throw new BadRequestError(`OpenRouter key verification failed: ${testResult.message}`);
  }

  const encrypted = encryptSecret(apiKey);
  const last4 = apiKey.slice(-4);

  // Upsert user_secret
  const existingSecret = await db.query.userSecrets.findFirst({
    where: and(eq(userSecrets.userId, userId), eq(userSecrets.keyType, 'openrouter_api_key')),
  });

  if (existingSecret) {
    await db
      .update(userSecrets)
      .set({
        encryptedValue: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
        last4,
        updatedAt: new Date(),
      })
      .where(eq(userSecrets.id, existingSecret.id));
  } else {
    await db.insert(userSecrets).values({
      userId,
      keyType: 'openrouter_api_key',
      encryptedValue: encrypted.ciphertext,
      iv: encrypted.iv,
      tag: encrypted.tag,
      last4,
    });
  }

  res.json({
    success: true,
    message: 'OpenRouter key encrypted and saved successfully.',
    maskedKey: maskSecret(apiKey),
    last4,
  });
});

/**
 * DELETE /api/settings/llm-key
 * Removes the user's stored OpenRouter key.
 */
settingsRouter.delete('/llm-key', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;

  await db
    .delete(userSecrets)
    .where(and(eq(userSecrets.userId, userId), eq(userSecrets.keyType, 'openrouter_api_key')));

  res.json({
    success: true,
    message: 'OpenRouter API key deleted.',
  });
});

/**
 * POST /api/settings/llm-key/test
 * Quick validation check for a provided key.
 */
settingsRouter.post('/llm-key/test', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = saveKeySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('Invalid key payload', parsed.error.issues);
  }

  const result = await openRouterProvider.testKey(parsed.data.apiKey);
  res.json(result);
});

/**
 * PATCH /api/settings
 * Updates default model or allowed domains.
 */
settingsRouter.patch('/', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  await ensureUserExists(userId);

  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('Invalid settings data', parsed.error.issues);
  }

  await db
    .update(userSettings)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId));

  res.json({ success: true, message: 'Settings updated' });
});

/**
 * GET /api/settings/models
 * Returns cached models from OpenRouter with free tool flags.
 */
settingsRouter.get('/models', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;

  // Look up user key if available
  const secret = await db.query.userSecrets.findFirst({
    where: and(eq(userSecrets.userId, userId), eq(userSecrets.keyType, 'openrouter_api_key')),
  });

  const models = await openRouterProvider.getAvailableModels();
  res.json({
    models,
    hasPersonalKey: Boolean(secret),
  });
});
