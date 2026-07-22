import { importPKCS8, SignJWT } from "jose";

const API = "https://api.github.com";

function config() {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !privateKey) return null;
  return { appId, privateKey };
}

export function githubAppConfigured(): boolean {
  return config() !== null;
}

async function appJwt(): Promise<string> {
  const current = config();
  if (!current) throw new Error("GitHub App 설정이 없습니다.");
  const key = await importPKCS8(current.privateKey, "RS256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(current.appId)
    .setIssuedAt()
    .setExpirationTime("9m")
    .sign(key);
}

export async function getInstallationToken(installationId: string, repositoryFullName: string): Promise<string> {
  const response = await fetch(`${API}/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await appJwt()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ repositories: [repositoryFullName] }),
  });
  if (!response.ok) throw new Error(`GitHub App 설치 토큰 발급 실패: ${response.status}`);
  const body = (await response.json()) as { token?: string };
  if (!body.token) throw new Error("GitHub App 설치 토큰이 응답되지 않았어요.");
  return body.token;
}
