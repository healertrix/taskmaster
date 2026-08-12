import crypto from 'crypto';

// Hand-rolled RS256 JWT signing (GitHub App auth requires RS256, no HS256
// option) instead of pulling in `jsonwebtoken`/`jose` — this is the one
// place that needs it, and Node's built-in `crypto` covers it in a dozen
// lines. See https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function getPrivateKey(): string {
  const key = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!key) throw new Error('Missing GITHUB_APP_PRIVATE_KEY env var');
  // Env vars can't hold real newlines cleanly in most hosting UIs (Vercel's
  // included) — the common convention is to paste the PEM with literal
  // "\n" sequences and un-escape them here.
  return key.includes('\\n') ? key.replace(/\\n/g, '\n') : key;
}

// A short-lived (9 min — GitHub's max is 10) App-level JWT, used only to
// mint installation access tokens (getInstallationToken below). Never used
// directly against the REST API for anything else.
function createAppJwt(): string {
  const appId = process.env.GITHUB_APP_ID;
  if (!appId) throw new Error('Missing GITHUB_APP_ID env var');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iat: now - 60, // backdated a minute for clock drift, GitHub's own recommendation
    exp: now + 9 * 60,
    iss: appId,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload)
  )}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signingInput)
    .sign(getPrivateKey());

  return `${signingInput}.${base64url(signature)}`;
}

// A per-installation access token (~1hr lifetime) — the actual credential
// used for REST calls scoped to whatever repos that installation covers.
// Minted fresh on every call rather than cached: webhook/callback
// invocations are infrequent enough (one GitHub event at a time) that the
// extra round-trip is cheap, and it avoids having to manage token
// expiry/refresh state in a serverless environment with no shared memory
// between invocations.
export async function getInstallationToken(
  installationId: number | string
): Promise<string> {
  const appJwt = createAppJwt();
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Failed to mint GitHub installation token (${res.status}): ${body}`
    );
  }

  const data = await res.json();
  return data.token as string;
}

// App-level lookup (App JWT, not an installation token) — used right after
// install to get the account name/type to store alongside the connection.
export async function getInstallationDetails(
  installationId: number | string
): Promise<{ account_login: string; account_type: string }> {
  const appJwt = createAppJwt();
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to fetch installation details (${res.status}): ${body}`);
  }
  const data = await res.json();
  return {
    account_login: data.account?.login || 'unknown',
    account_type: data.account?.type || 'Organization',
  };
}

// Lists every repo the installation currently has access to — used right
// after install (the callback route) to record them in github_repos, since
// GitHub doesn't push that list to you at install time.
export async function listInstallationRepos(
  installationId: number | string
): Promise<{ id: number; full_name: string }[]> {
  const token = await getInstallationToken(installationId);
  const repos: { id: number; full_name: string }[] = [];
  let page = 1;

  // Paginated — 100 per page is GitHub's max; loop until a short page.
  while (true) {
    const res = await fetch(
      `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `Failed to list installation repositories (${res.status}): ${body}`
      );
    }
    const data = await res.json();
    const pageRepos: { id: number; full_name: string }[] = (
      data.repositories || []
    ).map((r: any) => ({ id: r.id, full_name: r.full_name }));
    repos.push(...pageRepos);
    if (pageRepos.length < 100) break;
    page += 1;
  }

  return repos;
}
