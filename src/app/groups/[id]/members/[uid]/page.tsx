import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { weekBounds } from "@/lib/week";

export const dynamic = "force-dynamic";

const sourceLabel: Record<string, string> = {
  LEETCODE_GQL: "폴링",
  EXTENSION: "확장",
  MANUAL: "수동",
};

export default async function MemberPage({
  params,
}: {
  params: Promise<{ id: string; uid: string }>;
}) {
  const { id, uid } = await params;
  const groupId = Number(id);
  const userId = Number(uid);
  if (!Number.isFinite(groupId) || !Number.isFinite(userId)) notFound();

  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!group || !user) notFound();

  const { start, end, weekOf } = weekBounds(new Date(), group.timezone);

  const solves = await db
    .select()
    .from(schema.solveLogs)
    .where(eq(schema.solveLogs.userId, userId))
    .orderBy(desc(schema.solveLogs.acceptedAt));

  // 확장으로 올라온 코드 매핑
  const solveIds = solves.map((s) => s.id);
  const codes = solveIds.length
    ? await db.select().from(schema.submissions).where(inArray(schema.submissions.solveLogId, solveIds))
    : [];
  const codeBySolve = new Map(codes.map((c) => [c.solveLogId, c]));

  const thisWeekCount = solves.filter(
    (s) => s.acceptedAt >= start && s.acceptedAt < end,
  ).length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href={`/groups/${groupId}`} className="text-sm text-neutral-400 hover:text-neutral-200">
        ← {group.name}
      </Link>

      <h1 className="mt-3 text-2xl font-bold">{user.nickname}</h1>
      <p className="mt-1 text-sm text-neutral-400">
        LeetCode:{" "}
        {user.leetcodeHandle ? (
          <a
            href={`https://leetcode.com/u/${user.leetcodeHandle}/`}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:underline"
          >
            @{user.leetcodeHandle}
          </a>
        ) : (
          <span className="text-neutral-500">미연동</span>
        )}
        {" · "}이번 주 {thisWeekCount}/{group.quota} · 누적 {solves.length}솔
      </p>

      <h2 className="mt-8 text-lg font-semibold">푼 문제</h2>
      {solves.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          아직 수집된 풀이가 없어요. 폴링(핸들 연동) 또는 확장 업로드로 채워집니다.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-800 rounded-2xl border border-neutral-800 bg-neutral-900/40">
          {solves.map((s) => {
            const inWeek = s.acceptedAt >= start && s.acceptedAt < end;
            const code = codeBySolve.get(s.id);
            return (
              <li key={s.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <a
                    href={`https://leetcode.com/problems/${s.problemSlug}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium hover:text-emerald-400"
                  >
                    {s.problemTitle ?? s.problemSlug}
                  </a>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-neutral-500">
                    {inWeek && (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-400">이번 주</span>
                    )}
                    <span className="rounded bg-neutral-800 px-1.5 py-0.5">{sourceLabel[s.source]}</span>
                    <span>{s.acceptedAt.toISOString().slice(0, 10)}</span>
                  </div>
                </div>
                {code && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-200">
                      코드 보기 {code.language ? `(${code.language})` : ""}
                    </summary>
                    <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-neutral-950 p-3 text-xs text-neutral-200">
                      <code>{code.code}</code>
                    </pre>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
