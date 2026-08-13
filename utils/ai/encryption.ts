import crypto from 'crypto';

// Encrypts users' pasted AI provider API keys before they're stored in
// `ai_provider_keys.encrypted_key` (see the migration for why: this
// protects against a DB-only leak — a stolen backup, a read-only SQL
// injection — since the ciphertext is useless without this server-only
// secret; it's app-level AES, not defense against a fully compromised
// server, which no storage scheme survives). Follows the same
// hand-rolled-crypto convention as utils/github/verifyWebhook.ts rather
// than pulling in a dependency for this.
//
// AI_KEY_ENCRYPTION_SECRET must be a hex-encoded 32-byte key, e.g.
// generated once via `openssl rand -hex 32`.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended IV size for GCM

function getKey(): Buffer {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      'Missing AI_KEY_ENCRYPTION_SECRET env var — required to store/read AI provider API keys.'
    );
  }
  const key = Buffer.from(secret, 'hex');
  if (key.length !== 32) {
    throw new Error(
      'AI_KEY_ENCRYPTION_SECRET must decode to exactly 32 bytes (hex-encoded AES-256 key).'
    );
  }
  return key;
}

// Stored format: "<iv>:<authTag>:<ciphertext>", each segment base64.
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decrypt(stored: string): string {
  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = stored.split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Malformed encrypted value');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}
