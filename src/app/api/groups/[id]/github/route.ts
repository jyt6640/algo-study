import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { getMembership } from "@/lib/membership";
import { createRepo, getRepo, putFile, ensureLabels } from "@/lib/github";
import { PR_TEMPLATE, AUTO_LABEL_WORKFLOW, LABELS } from "@/lib/github-kit";

export const runtime = "nodejs";
export const maxDuration = 60;

// 방장이 풀이 레포를 연동하고 PR 템플릿·자동 라벨·라벨 세트를 설치한다.
// POST body: { mode: "new" | "existing", repo, private? }
//   new: repo = 새 레포 이름, existing: repo = "owner/repo"
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const groupId = Number(id);
  const membership = await getMembership(userId, groupId);
  if (membership?.role !== "OWNER") {
    return NextResponse.json({ error: "방장만 레포를 연동할 수 있어요." }, { status: 403 });
  }

  const [me] = await db
    .select({ token: schema.users.githubToken })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!me?.token) {
    return NextResponse.json(
      { error: "레포 권한이 없어요. 로그아웃 후 다시 로그인해 GitHub 레포 접근을 허용해주세요." },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const mode = body?.mode === "new" ? "new" : "existing";
  const repoInput = typeof body?.repo === "string" ? body.repo.trim() : "";
  if (!repoInput) return NextResponse.json({ error: "레포 정보가 필요합니다." }, { status: 400 });

  try {
    let fullName: string;
    if (mode === "new") {
      const name = repoInput.replace(/[^A-Za-z0-9._-]/g, "-");
      const created = await createRepo(me.token, name, Boolean(body?.private));
      fullName = created.fullName;
    } else {
      const clean = repoInput.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
      const repo = await getRepo(me.token, clean);
      if (!repo) {
        return NextResponse.json({ error: "레포를 찾을 수 없거나 접근 권한이 없어요." }, { status: 404 });
      }
      if (!repo.permissions?.push) {
        return NextResponse.json(
          { error: "이 레포에 push 권한이 없어요. 본인 레포를 연결하거나 새로 만드세요." },
          { status: 403 },
        );
      }
      fullName = repo.full_name;
    }

    // PR 템플릿 + 자동 라벨 워크플로우 + 라벨 세트 설치
    await putFile(me.token, fullName, ".github/pull_request_template.md", PR_TEMPLATE, "chore: add PR template (7일 7솔)");
    await putFile(
      me.token,
      fullName,
      ".github/workflows/auto-label.yml",
      AUTO_LABEL_WORKFLOW,
      "ci: add PR auto-labeler (7일 7솔)",
    );
    await ensureLabels(me.token, fullName, LABELS);

    await db.update(schema.groups).set({ githubRepo: fullName }).where(eq(schema.groups.id, groupId));
    return NextResponse.json({ ok: true, repo: fullName });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "연동 실패" }, { status: 502 });
  }
}

// 연동 해제 (레포 자체는 그대로, 링크만 제거)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  const groupId = Number(id);
  if ((await getMembership(userId, groupId))?.role !== "OWNER") {
    return NextResponse.json({ error: "방장만 해제할 수 있어요." }, { status: 403 });
  }
  await db.update(schema.groups).set({ githubRepo: null }).where(eq(schema.groups.id, groupId));
  return NextResponse.json({ ok: true });
}
