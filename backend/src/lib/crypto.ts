import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

/**
 * Resolves the 32-byte master key from hex string or raw string.
 */
function resolveKey(customKey?: string): Buffer {
  const rawKey = customKey || process.env.SECRETS_MASTER_KEY;
  if (!rawKey) {
    throw new Error('SECRETS_MASTER_KEY is required for encryption at rest.');
  }

  // If 64-char hex string:
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }

  // Fallback: SHA-256 hash to guarantee 32 bytes
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts sensitive string using AES-256-GCM.
 */
export function encryptSecret(plaintext: string, masterKey?: string): EncryptedPayload {
  const key = resolveKey(masterKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: 16 });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    tag,
  };
}

/**
 * Decrypts AES-256-GCM payload.
 */
export function decryptSecret(payload: EncryptedPayload, masterKey?: string): string {
  const key = resolveKey(masterKey);
  const iv = Buffer.from(payload.iv, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: 16 });
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));

  let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Masks a secret showing only the last 4 characters.
 */
export function maskSecret(secret: string): string {
  const clean = secret.trim();
  if (clean.length <= 4) return '••••';
  return `••••••••${clean.slice(-4)}`;
}

/**
 * Produces deterministic SHA-256 hash for confirmation payload freezing.
 */
export function hashPayload(payload: unknown): string {
  const sortedJson = JSON.stringify(payload, Object.keys(payload as object).sort());
  return crypto.createHash('sha256').update(sortedJson).digest('hex');
}
