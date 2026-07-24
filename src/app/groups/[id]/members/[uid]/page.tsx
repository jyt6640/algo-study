import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { currentPeriod } from "@/lib/week";
import { fmtDateTime, combineHeatmap } from "@/lib/format";
import { problemUrl, platformLabel } from "@/lib/platform";
import { fetchFullProfile } from "@/lib/leetcode";
import { currentUserId } from "@/lib/session";
import { getMembership } from "@/lib/membership";
import { ProfileCard } from "@/components/ProfileCard";
import { Heatmap } from "@/components/Heatmap";
import { MembersOnly } from "@/components/MembersOnly";
import { CodeBlock } from "@/components/CodeBlock";

export const dynamic = "force-dynamic";

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
  if (!group) notFound();

  const viewerId = await currentUserId();
  const viewerMembership = await getMembership(viewerId, groupId);
  if (!viewerMembership) return <MembersOnly groupId={groupId} />;

  const [targetMembership] = await db
    .select({ userId: schema.memberships.userId })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.groupId, groupId), eq(schema.memberships.userId, userId)))
    .limit(1);
  if (!targetMembership) notFound();

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) notFound();

  const { start, end, periodOf: weekOf } = currentPeriod(new Date(), group);

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

  // 연동돼 있으면 LeetCode 프로필 + 잔디 데이터
  const profile = user.leetcodeHandle
    ? await fetchFullProfile(user.leetcodeHandle).catch(() => null)
    : null;

  // 통합 잔디: LeetCode 는 전체 캘린더(전 기록), 프로그래머스는 수집한 풀이.
  const pgDates = solves.filter((s) => s.platform === "PROGRAMMERS").map((s) => s.acceptedAt);
  const { total: combinedCal, breakdown: combinedBreak } = combineHeatmap(
    profile?.calendar,
    pgDates,
    group.timezone,
  );
  const lcCount = profile?.solved.all ?? solves.filter((s) => s.platform === "LEETCODE").length;
  const pgCount = pgDates.length;

  return (
    <main className="rise mx-auto max-w-2xl px-6 py-14">
      <div className="flex items-center gap-3 text-sm">
        <Link href={`/groups/${groupId}`} className="text-secondary hover:underline">
          ← {group.name}
        </Link>
        <Link href="/" className="text-secondary hover:underline">
          홈
        </Link>
      </div>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{user.nickname}</h1>
      <p className="mt-2 text-sm text-secondary">
        LeetCode:{" "}
        {user.leetcodeHandle ? (
          <a
            href={`https://leetcode.com/u/${user.leetcodeHandle}/`}
            target="_blank"
            rel="noreferrer"
            className="accent hover:underline"
          >
            @{user.leetcodeHandle}
          </a>
        ) : (
          <span className="text-secondary">미연동</span>
        )}
        {" · "}이번 기간 {thisWeekCount}/{group.quota} · 누적 {solves.length}솔
      </p>

      {profile && (
        <div className="mt-8">
          <ProfileCard profile={profile} showHeatmap={false} />
        </div>
      )}

      {solves.length > 0 && (
        <section className="card mt-6 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">잔디밭 🌱</div>
            <div className="flex gap-3 text-xs text-secondary">
              <span>리트코드 {lcCount}</span>
              <span>프로그래머스 {pgCount}</span>
            </div>
          </div>
          <p className="mb-3 mt-1 text-xs text-secondary">
            스터디에 집계된 풀이 기준. 칸에 마우스를 올리면 플랫폼별 개수가 보여요.
          </p>
          <Heatmap calendar={combinedCal} breakdown={combinedBreak} />
        </section>
      )}

      <h2 className="mt-10 text-xl font-semibold">푼 문제</h2>
      {solves.length === 0 ? (
        <p className="mt-4 text-sm text-secondary">
          아직 수집된 풀이가 없어요. 핸들 연동 또는 확장 업로드로 채워집니다.
        </p>
      ) : (
        <ul className="card mt-4 divide-y" style={{ borderColor: "var(--border)" }}>
          {solves.map((s) => {
            const inWeek = s.acceptedAt >= start && s.acceptedAt < end;
            const code = codeBySolve.get(s.id);
            return (
              <li key={s.id} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  {problemUrl(s.platform, s.problemSlug) ? (
                    <a
                      href={problemUrl(s.platform, s.problemSlug)!}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium hover:underline"
                    >
                      {s.problemTitle ?? s.problemSlug}
                    </a>
                  ) : (
                    <span className="font-medium">{s.problemTitle ?? s.problemSlug}</span>
                  )}
                  <div className="flex shrink-0 items-center gap-2 text-xs text-secondary">
                    {inWeek && (
                      <span
                        className="rounded-full px-2 py-0.5"
                        style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}
                      >
                        이번 기간
                      </span>
                    )}
                    <span
                      className="rounded-full px-2 py-0.5"
                      style={{ background: "var(--surface-2)" }}
                    >
                      {platformLabel[s.platform]}
                    </span>
                    <span>{fmtDateTime(s.acceptedAt, group.timezone)}</span>
                  </div>
                </div>
                {code && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-secondary hover:underline">
                      코드 보기 {code.language ? `(${code.language})` : ""}
                    </summary>
                    <div className="mt-2 max-h-96 overflow-auto">
                      <CodeBlock code={code.code} language={code.language} />
                    </div>
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
