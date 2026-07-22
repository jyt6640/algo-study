import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { fmtDateTime } from "@/lib/format";
import { problemUrl, platformLabel } from "@/lib/platform";
import { currentUserId } from "@/lib/session";
import { getMembership } from "@/lib/membership";
import { MembersOnly } from "@/components/MembersOnly";
import { ManualCodeEntry } from "@/components/ManualCodeEntry";
import { CodeBlock } from "@/components/CodeBlock";

export const dynamic = "force-dynamic";

export default async function SolvePage({
  params,
}: {
  params: Promise<{ id: string; solveId: string }>;
}) {
  const { id, solveId } = await params;
  const groupId = Number(id);
  const sid = Number(solveId);
  if (!Number.isFinite(groupId) || !Number.isFinite(sid)) notFound();

  const [group] = await db
    .select({ timezone: schema.groups.timezone })
    .from(schema.groups)
    .where(eq(schema.groups.id, groupId))
    .limit(1);
  if (!group) notFound();
  const tz = group.timezone;

  const viewerId = await currentUserId();
  if (!(await getMembership(viewerId, groupId))) return <MembersOnly groupId={groupId} />;

  const [solve] = await db
    .select({
      userId: schema.solveLogs.userId,
      nickname: schema.users.nickname,
      image: schema.users.image,
      platform: schema.solveLogs.platform,
      slug: schema.solveLogs.problemSlug,
      title: schema.solveLogs.problemTitle,
      difficulty: schema.solveLogs.difficulty,
      acceptedAt: schema.solveLogs.acceptedAt,
    })
    .from(schema.solveLogs)
    .innerJoin(schema.users, eq(schema.users.id, schema.solveLogs.userId))
    .innerJoin(
      schema.memberships,
      and(
        eq(schema.memberships.userId, schema.solveLogs.userId),
        eq(schema.memberships.groupId, groupId),
      ),
    )
    .where(eq(schema.solveLogs.id, sid))
    .limit(1);
  if (!solve) notFound();

  const [code] = await db
    .select()
    .from(schema.submissions)
    .where(eq(schema.submissions.solveLogId, sid))
    .limit(1);

  return (
    <main className="rise mx-auto max-w-2xl px-6 py-14">
      <Link href={`/groups/${groupId}`} className="text-sm text-secondary hover:underline">
        ← 대시보드
      </Link>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{solve.title ?? solve.slug}</h1>
        <a
          href={problemUrl(solve.platform, solve.slug)}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary shrink-0 !px-4 !py-1.5 text-sm"
        >
          {platformLabel[solve.platform]}에서 열기
        </a>
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm text-secondary">
        <Link
          href={`/groups/${groupId}/members/${solve.userId}`}
          className="flex items-center gap-1.5 hover:underline"
        >
          {solve.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={solve.image} alt="" className="h-5 w-5 rounded-full" />
          )}
          {solve.nickname}
        </Link>
        <span>·</span>
        <span>{fmtDateTime(solve.acceptedAt, tz)} 해결</span>
        {solve.difficulty && (
          <>
            <span>·</span>
            <span>{solve.difficulty}</span>
          </>
        )}
      </div>

      {code ? (
        <div className="mt-6">
          <div className="mb-2 text-sm font-semibold">
            정답 코드 {code.language ? <span className="text-secondary">({code.language})</span> : null}
          </div>
          <CodeBlock code={code.code} language={code.language} />
        </div>
      ) : (
        <div className="card mt-6 p-6 text-sm text-secondary">
          아직 이 문제의 코드가 없어요. 아래에 직접 붙여넣어 저장하거나 확장프로그램으로 자동 업로드할 수 있어요.
        </div>
      )}

      {viewerId === solve.userId && (
        <ManualCodeEntry solveId={sid} initialCode={code?.code} initialLanguage={code?.language} />
      )}
    </main>
  );
}
