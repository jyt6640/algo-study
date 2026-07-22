import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { getMembership } from "@/lib/membership";
import { getRepo, putFile, ensureLabels } from "@/lib/github";
import { PR_TEMPLATE, AUTO_LABEL_WORKFLOW, LABELS } from "@/lib/github-kit";
import { getInstallationToken, githubAppConfigured } from "@/lib/githubApp";
import { githubLinkSchema } from "@/lib/groupValidation";
import { readJsonBody } from "@/lib/ingestValidation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const groupId = Number(id);
  const membership = await getMembership(userId, groupId);
  if (membership?.role !== "OWNER") {
    return NextResponse.json({ error: "방장만 레포를 연동할 수 있어요." }, { status: 403 });
  }

  if (!githubAppConfigured()) {
    return NextResponse.json({ error: "GitHub App이 아직 설정되지 않았어요." }, { status: 503 });
  }

  const [installation] = await db
    .select()
    .from(schema.groupGithubInstallations)
    .where(and(eq(schema.groupGithubInstallations.groupId, groupId), eq(schema.groupGithubInstallations.enabled, true)))
    .limit(1);

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  const parsed = githubLinkSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력 형식이 올바르지 않습니다." }, { status: 400 });
  const repoInput = parsed.data.repo;
  const installationId = parsed.data.installationId || installation?.installationId;
  if (!installationId) return NextResponse.json({ error: "GitHub App 설치 ID가 필요합니다." }, { status: 400 });

  try {
    const clean = repoInput.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(clean)) {
      return NextResponse.json({ error: "owner/repo 형식이 필요합니다." }, { status: 400 });
    }
    const token = await getInstallationToken(installationId, clean);
    const repo = await getRepo(token, clean);
    if (!repo) return NextResponse.json({ error: "선택된 GitHub App 레포를 찾을 수 없어요." }, { status: 404 });
    if (!repo.permissions?.push) return NextResponse.json({ error: "GitHub App에 push 권한이 없어요." }, { status: 403 });
    const fullName = repo.full_name;

    await putFile(token, fullName, ".github/pull_request_template.md", PR_TEMPLATE, "chore: add PR template (7일 7솔)");
    await putFile(
      token,
      fullName,
      ".github/workflows/auto-label.yml",
      AUTO_LABEL_WORKFLOW,
      "ci: add PR auto-labeler (7일 7솔)",
    );
    await ensureLabels(token, fullName, LABELS);

    await db
      .insert(schema.groupGithubInstallations)
      .values({
        groupId,
        installationId,
        repositoryId: String(repo.id),
        repositoryFullName: fullName,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: schema.groupGithubInstallations.groupId,
        set: { installationId, repositoryId: String(repo.id), repositoryFullName: fullName, enabled: true },
      });
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
  await db
    .update(schema.groupGithubInstallations)
    .set({ enabled: false })
    .where(eq(schema.groupGithubInstallations.groupId, groupId));
  return NextResponse.json({ ok: true });
}
