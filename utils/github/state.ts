import crypto from 'crypto';

// Signs/verifies the `state` param round-tripped through GitHub's install
// flow (taskmaster -> github.com/apps/.../installations/new?state=... ->
// GitHub redirects back to our callback with the same state). This is
// what stops someone from crafting their own callback URL with an
// arbitrary workspaceId and hijacking a GitHub installation onto a
// workspace they don't administer.
//
// Reuses GITHUB_WEBHOOK_SECRET to sign rather than introducing a dedicated
// secret — different purpose, but it's already a server-only secret only
// this app holds, which is all an HMAC key needs to be.
const STATE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes — long enough to click through GitHub's install UI

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function getSecret(): string {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) throw new Error('Missing GITHUB_WEBHOOK_SECRET env var');
  return secret;
}

export function signInstallState(workspaceId: string): string {
  const payload = JSON.stringify({ workspaceId, ts: Date.now() });
  const encodedPayload = base64url(payload);
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(encodedPayload)
    .digest('hex');
  return `${encodedPayload}.${signature}`;
}

export function verifyInstallState(state: string | null): { workspaceId: string } | null {
  if (!state) return null;
  const [encodedPayload, signature] = state.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', getSecret())
    .update(encodedPayload)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8'));
    if (Date.now() - payload.ts > STATE_MAX_AGE_MS) return null;
    if (!payload.workspaceId) return null;
    return { workspaceId: payload.workspaceId };
  } catch {
    return null;
  }
}
