import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { fmtDate, fmtTime } from "@/lib/format";
import { problemUrl, platformLabel } from "@/lib/platform";

export const dynamic = "force-dynamic";

const sourceLabel: Record<string, string> = {
  LEETCODE_GQL: "폴링",
  EXTENSION: "확장",
  MANUAL: "수동",
};

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
  if (!group) notFound();

  const members = await db
    .select({ userId: schema.memberships.userId })
    .from(schema.memberships)
    .where(eq(schema.memberships.groupId, groupId));
  const memberIds = members.map((m) => m.userId);

  const solves = memberIds.length
    ? await db
        .select({
          id: schema.solveLogs.id,
          userId: schema.solveLogs.userId,
          nickname: schema.users.nickname,
          image: schema.users.image,
          platform: schema.solveLogs.platform,
          slug: schema.solveLogs.problemSlug,
          title: schema.solveLogs.problemTitle,
          difficulty: schema.solveLogs.difficulty,
          acceptedAt: schema.solveLogs.acceptedAt,
          source: schema.solveLogs.source,
        })
        .from(schema.solveLogs)
        .innerJoin(schema.users, eq(schema.users.id, schema.solveLogs.userId))
        .where(inArray(schema.solveLogs.userId, memberIds))
        .orderBy(desc(schema.solveLogs.acceptedAt))
        .limit(80)
    : [];

  // 코드(확장 업로드) 매핑
  const solveIds = solves.map((s) => s.id);
  const codes = solveIds.length
    ? await db.select().from(schema.submissions).where(inArray(schema.submissions.solveLogId, solveIds))
    : [];
  const codeBySolve = new Map(codes.map((c) => [c.solveLogId, c]));

  // 날짜별 그룹 (그룹 타임존 기준)
  const byDate = new Map<string, typeof solves>();
  for (const s of solves) {
    const d = fmtDate(s.acceptedAt, group.timezone);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(s);
  }

  return (
    <main className="rise mx-auto max-w-2xl px-6 py-14">
      <Link href={`/groups/${groupId}`} className="text-sm text-secondary hover:underline">
        ← {group.name}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">스터디 활동</h1>
      <p className="mt-2 text-sm text-secondary">
        누가 어떤 문제를 풀었는지 한눈에 보기. 확장으로 올린 풀이는 코드까지 볼 수 있어요.
      </p>

      {solves.length === 0 ? (
        <p className="mt-8 text-sm text-secondary">
          아직 수집된 풀이가 없어요. 멤버가 LeetCode를 연동하고 문제를 풀면 여기에 쌓입니다.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          {[...byDate.entries()].map(([date, list]) => (
            <div key={date}>
              <div className="mb-2 text-sm font-semibold text-secondary">{date}</div>
              <ul className="card divide-y" style={{ borderColor: "var(--border)" }}>
                {list.map((s) => {
                  const code = codeBySolve.get(s.id);
                  return (
                    <li key={s.id} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Link
                            href={`/groups/${groupId}/members/${s.userId}`}
                            className="flex shrink-0 items-center gap-1.5 hover:underline"
                          >
                            {s.image && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.image} alt="" className="h-5 w-5 rounded-full" />
                            )}
                            <span className="text-sm font-medium">{s.nickname}</span>
                          </Link>
                          <span className="text-secondary">·</span>
                          <a
                            href={problemUrl(s.platform, s.slug)}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-sm hover:underline"
                          >
                            {s.title ?? s.slug}
                          </a>
                          <span className="shrink-0 text-xs text-secondary">· {platformLabel[s.platform]}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-secondary">{fmtTime(s.acceptedAt, group.timezone)}</span>
                          <span
                            className="rounded-full px-2 py-0.5 text-xs"
                            style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                          >
                            {sourceLabel[s.source]}
                          </span>
                        </div>
                      </div>
                      {code && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-secondary hover:underline">
                            어떻게 풀었나 — 코드 보기 {code.language ? `(${code.language})` : ""}
                          </summary>
                          <pre
                            className="mt-2 max-h-96 overflow-auto rounded-xl p-3 text-xs"
                            style={{ background: "var(--surface-2)", fontFamily: "var(--mono)" }}
                          >
                            <code>{code.code}</code>
                          </pre>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
