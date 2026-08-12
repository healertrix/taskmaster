import crypto from 'crypto';

// GitHub signs every webhook delivery with HMAC-SHA256 over the raw request
// body, sent as `X-Hub-Signature-256: sha256=<hex>`. Verifying this is what
// stops anyone else from POSTing fake merge/push events at the webhook URL
// and, say, forging a "PR merged" event to move cards around.
//
// `rawBody` MUST be the exact bytes GitHub sent (before any JSON.parse) —
// signing is over the raw payload, not a re-serialized version of it, which
// can differ in whitespace/key order and silently break verification.
export function verifyGithubWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) throw new Error('Missing GITHUB_WEBHOOK_SECRET env var');
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);

  // Constant-time comparison — a naive `===` leaks timing info an attacker
  // could use to guess the signature byte-by-byte. Lengths must match
  // first since timingSafeEqual throws on mismatched buffer lengths.
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
