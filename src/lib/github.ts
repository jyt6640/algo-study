// GitHub REST API 헬퍼 (사용자 OAuth 토큰 사용).

const API = "https://api.github.com";

async function gh(token: string, path: string, init?: RequestInit) {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

export async function getAuthedLogin(token: string): Promise<string | null> {
  const res = await gh(token, "/user");
  if (!res.ok) return null;
  const j = await res.json();
  return j.login ?? null;
}

/** 새 레포 생성. 이미 있으면 그대로 반환. { owner/repo, defaultBranch } */
export async function createRepo(
  token: string,
  name: string,
  isPrivate: boolean,
): Promise<{ fullName: string; defaultBranch: string }> {
  const res = await gh(token, "/user/repos", {
    method: "POST",
    body: JSON.stringify({ name, private: isPrivate, auto_init: true, description: "알고리즘 스터디 풀이" }),
  });
  if (res.status === 422) {
    // 이미 존재 → 조회
    const login = await getAuthedLogin(token);
    const g = await gh(token, `/repos/${login}/${name}`);
    if (!g.ok) throw new Error("레포 생성 실패(이미 존재하지만 접근 불가)");
    const j = await g.json();
    return { fullName: j.full_name, defaultBranch: j.default_branch };
  }
  if (!res.ok) throw new Error(`레포 생성 실패: ${res.status} ${(await res.text()).slice(0, 120)}`);
  const j = await res.json();
  return { fullName: j.full_name, defaultBranch: j.default_branch };
}

export async function getRepo(token: string, fullName: string) {
  const res = await gh(token, `/repos/${fullName}`);
  if (!res.ok) return null;
  return res.json();
}

/** 파일 생성/수정 (Base64). 이미 있으면 sha 를 붙여 갱신. */
export async function putFile(token: string, fullName: string, path: string, content: string, message: string) {
  const existing = await gh(token, `/repos/${fullName}/contents/${encodeURI(path)}`);
  let sha: string | undefined;
  if (existing.ok) sha = (await existing.json()).sha;
  const res = await gh(token, `/repos/${fullName}/contents/${encodeURI(path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw new Error(`${path} 커밋 실패: ${res.status}`);
}

/** 라벨 세트 보장 (없으면 생성, 있으면 색/설명 갱신) */
export async function ensureLabels(
  token: string,
  fullName: string,
  labels: Array<{ name: string; color: string; description: string }>,
) {
  for (const l of labels) {
    const create = await gh(token, `/repos/${fullName}/labels`, {
      method: "POST",
      body: JSON.stringify({ name: l.name, color: l.color, description: l.description }),
    });
    if (create.status === 422) {
      // 이미 존재 → 갱신
      await gh(token, `/repos/${fullName}/labels/${encodeURIComponent(l.name)}`, {
        method: "PATCH",
        body: JSON.stringify({ color: l.color, description: l.description }),
      });
    }
  }
}
