import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { fmtDateTime } from "@/lib/format";
import { problemUrl, platformLabel } from "@/lib/platform";

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
  const tz = group?.timezone ?? "Asia/Seoul";

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
          <pre
            className="overflow-auto rounded-2xl p-4 text-sm leading-relaxed"
            style={{ background: "var(--surface-2)", fontFamily: "var(--mono)" }}
          >
            <code>{code.code}</code>
          </pre>
        </div>
      ) : (
        <div className="card mt-6 p-6 text-sm text-secondary">
          아직 이 문제의 코드가 없어요. 확장프로그램으로 <b className="text-[color:var(--text)]">Accepted 후 「📤 스터디 업로드」</b>{" "}
          하면 정답 코드가 여기에 표시됩니다.
        </div>
      )}
    </main>
  );
}
