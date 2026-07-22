import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { currentPeriod } from "@/lib/week";
import { calcPenalty } from "@/lib/penalty";
import { currentUserId } from "@/lib/session";
import { fmtDateTime } from "@/lib/format";
import { maybeRefreshLeetcode, maybeRefreshGroupMembers } from "@/lib/refresh";
import { fetchDailyChallenge } from "@/lib/leetcode";
import { currentUserIsAdmin } from "@/lib/admin";
import { PublicStudy } from "./PublicStudy";
import { MemberPanel } from "./MemberPanel";
import { LedgerEntry } from "./LedgerEntry";
import { LeaveButton } from "./LeaveButton";
import { CheatReportButton } from "@/components/CheatReportButton";

export const dynamic = "force-dynamic";

export default async function GroupDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
  if (!group) notFound();

  const viewerId = await currentUserId();
  // 스터디 열면 내 LeetCode + 전 멤버 최근 풀이를 자동 반영 (쓰로틀, 실패해도 무시).
  // 확장을 안 쓰는 멤버의 풀이도 대시보드를 열 때 실시간처럼 반영된다.
  if (viewerId) await maybeRefreshLeetcode(viewerId).catch(() => {});
  await maybeRefreshGroupMembers(groupId).catch(() => {});

  const [viewerMembership] = viewerId
    ? await db
        .select({ role: schema.memberships.role })
        .from(schema.memberships)
        .where(and(eq(schema.memberships.userId, viewerId), eq(schema.memberships.groupId, groupId)))
        .limit(1)
    : [];
  const isOwner = viewerMembership?.role === "OWNER";
  const isMember = Boolean(viewerMembership);
  const admin = await currentUserIsAdmin();

  // 비멤버는 공개 운영 개요만 (초대코드·정산 계좌·멤버 개인기록은 숨김). 관리자는 예외.
  if (!isMember && !admin) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.memberships)
      .where(eq(schema.memberships.groupId, groupId));
    return <PublicStudy group={group} memberCount={count ?? 0} />;
  }

  const [viewer] = viewerId
    ? await db
        .select({ leetcode: schema.users.leetcodeHandle, programmers: schema.users.programmersHandle })
        .from(schema.users)
        .where(eq(schema.users.id, viewerId))
        .limit(1)
    : [];
  const viewerLinked = Boolean(viewer?.leetcode || viewer?.programmers);

  const { start, end, periodOf: weekOf, notStarted, ended } = currentPeriod(new Date(), group);

  const members = await db
    .select({ userId: schema.memberships.userId, nickname: schema.users.nickname, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.groupId, groupId));

  const rows = await Promise.all(
    members.map(async (m) => {
      // 이번 주 푼 문제 목록 (slug 는 유저당 유일하므로 이미 distinct)
      const weekSolves = await db
        .select({
          id: schema.solveLogs.id,
          slug: schema.solveLogs.problemSlug,
          title: schema.solveLogs.problemTitle,
          acceptedAt: schema.solveLogs.acceptedAt,
        })
        .from(schema.solveLogs)
        .where(
          and(
            eq(schema.solveLogs.userId, m.userId),
            gte(schema.solveLogs.acceptedAt, start),
            lt(schema.solveLogs.acceptedAt, end),
          ),
        )
        .orderBy(desc(schema.solveLogs.acceptedAt));
      const solved = weekSolves.length;
      return {
        ...m,
        solved,
        weekSolves,
        projectedPenalty: calcPenalty(group.penaltyType, group.penaltyAmount, group.quota, solved),
      };
    }),
  );
  rows.sort((a, b) => b.solved - a.solved);

  // 이번 기간 예상 총 벌금 (미달 멤버 합산)
  const periodPenaltyTotal = rows.reduce((s, r) => s + r.projectedPenalty, 0);
  const behindCount = rows.filter((r) => r.solved < group.quota).length;

  // 이번 기간 풀이들에 대한 치팅 의심 신고 집계
  const periodSolveIds = rows.flatMap((r) => r.weekSolves.map((s) => s.id));
  const reportRows = periodSolveIds.length
    ? await db
        .select({ solveLogId: schema.cheatReports.solveLogId, reporterId: schema.cheatReports.reporterId })
        .from(schema.cheatReports)
        .where(inArray(schema.cheatReports.solveLogId, periodSolveIds))
    : [];
  const reportCount = new Map<number, number>();
  const reportedByViewer = new Set<number>();
  for (const r of reportRows) {
    reportCount.set(r.solveLogId, (reportCount.get(r.solveLogId) ?? 0) + 1);
    if (viewerId && r.reporterId === viewerId) reportedByViewer.add(r.solveLogId);
  }
  const canSeeReportCount = isOwner || admin;

  // 오늘의 LeetCode 문제 (1시간 캐시, 실패해도 무시)
  const daily = await fetchDailyChallenge().catch(() => null);

  // 지난주까지 확정된 벌금 장부
  const ledger = await db
    .select({
      id: schema.weeklyResults.id,
      weekOf: schema.weeklyResults.weekOf,
      nickname: schema.users.nickname,
      solvedCount: schema.weeklyResults.solvedCount,
      metQuota: schema.weeklyResults.metQuota,
      penaltyAmount: schema.weeklyResults.penaltyAmount,
      exempt: schema.weeklyResults.exempt,
      paid: schema.weeklyResults.paid,
    })
    .from(schema.weeklyResults)
    .innerJoin(schema.users, eq(schema.users.id, schema.weeklyResults.userId))
    .where(eq(schema.weeklyResults.groupId, groupId))
    .orderBy(desc(schema.weeklyResults.weekOf));

  const ledgerByWeek = new Map<string, typeof ledger>();
  for (const l of ledger) {
    if (!ledgerByWeek.has(l.weekOf)) ledgerByWeek.set(l.weekOf, []);
    ledgerByWeek.get(l.weekOf)!.push(l);
  }
  // 면제 제외한 총 벌금 / 미납 합계
  const owed = ledger.filter((l) => !l.exempt && l.penaltyAmount > 0);
  const totalPenalty = owed.reduce((s, l) => s + l.penaltyAmount, 0);
  const unpaidTotal = owed.filter((l) => !l.paid).reduce((s, l) => s + l.penaltyAmount, 0);

  const msLeft = end.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.floor(msLeft / 86400000));
  const hoursLeft = Math.max(0, Math.floor((msLeft % 86400000) / 3600000));

  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <div className="rise flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {group.name}
            {!group.active && (
              <span className="ml-2 align-middle text-sm text-secondary">· 비활성(일시정지)</span>
            )}
          </h1>
          <p className="mt-2 text-sm text-secondary">
            {ended ? (
              <b style={{ color: "var(--text)" }}>스터디 종료</b>
            ) : notStarted ? (
              <>
                시작 예정 · <b style={{ color: "var(--text)" }}>{weekOf}부터</b>
              </>
            ) : (
              <>
                이번 기간 ({weekOf} 시작) · 마감까지{" "}
                <b style={{ color: "var(--text)" }}>
                  {daysLeft}일 {hoursLeft}시간
                </b>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-secondary">
            {group.periodDays}일마다 {group.quota}문제 · 벌금{" "}
            {group.penaltyType === "FIXED" ? "미달 시" : "부족 문제당"} {group.penaltyAmount.toLocaleString()}원
            {group.startDate && (
              <span>
                {" · "}
                {group.startDate}
                {group.endDate ? ` ~ ${group.endDate}` : " ~"}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {isOwner && (
            <div className="card px-4 py-3 text-right">
              <div className="text-xs text-secondary">초대코드 (방장만)</div>
              <div className="accent font-mono text-xl font-semibold tracking-widest">{group.inviteCode}</div>
            </div>
          )}
          <div className="flex gap-3 text-sm">
            {group.githubRepo && (
              <a
                href={`https://github.com/${group.githubRepo}`}
                target="_blank"
                rel="noreferrer"
                className="text-secondary hover:underline"
              >
                GitHub
              </a>
            )}
            <Link href={`/groups/${groupId}/activity`} className="text-secondary hover:underline">
              활동
            </Link>
            <Link href="/me" className="text-secondary hover:underline">
              내 프로필
            </Link>
            <Link href="/" className="text-secondary hover:underline">
              내 스터디
            </Link>
            {isOwner ? (
              <Link href={`/groups/${groupId}/settings`} className="accent hover:underline">
                설정
              </Link>
            ) : (
              isMember && <LeaveButton groupId={groupId} />
            )}
          </div>
        </div>
      </div>

      {!notStarted && !ended && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="card p-5">
            <div className="text-xs text-secondary">이번 기간 예상 총 벌금</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: periodPenaltyTotal > 0 ? "var(--warning)" : "var(--success)" }}>
              {periodPenaltyTotal.toLocaleString()}원
            </div>
            <div className="mt-1 text-xs text-secondary">
              {behindCount > 0 ? `${behindCount}명 미달 · 마감까지 반영` : "전원 달성 중 🎉"}
            </div>
          </div>
          {daily && (
            <a href={daily.url} target="_blank" rel="noreferrer" className="card group p-5 transition hover:brightness-105">
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary">오늘의 LeetCode 문제</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    background:
                      daily.difficulty === "Easy"
                        ? "color-mix(in srgb, var(--success) 16%, transparent)"
                        : daily.difficulty === "Hard"
                          ? "color-mix(in srgb, var(--danger) 16%, transparent)"
                          : "color-mix(in srgb, var(--warning) 18%, transparent)",
                    color:
                      daily.difficulty === "Easy"
                        ? "var(--success)"
                        : daily.difficulty === "Hard"
                          ? "var(--danger)"
                          : "var(--warning)",
                  }}
                >
                  {daily.difficulty}
                </span>
              </div>
              <div className="mt-1 text-lg font-semibold tracking-tight group-hover:underline">{daily.title}</div>
              <div className="mt-1 text-xs text-secondary">{daily.date} · LeetCode에서 풀기 →</div>
            </a>
          )}
        </div>
      )}

      <div className="mt-8 space-y-3">
        {rows.map((r) => {
          const met = r.solved >= group.quota;
          return (
            <div key={r.userId} className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/groups/${groupId}/members/${r.userId}`}
                  className="group flex items-center gap-2 font-semibold"
                >
                  <span className="group-hover:underline">{r.nickname}</span>
                  {r.role === "OWNER" && <span className="accent text-xs">방장</span>}
                  <span className="text-xs text-secondary opacity-0 transition-opacity group-hover:opacity-100">
                    문제 보기 →
                  </span>
                </Link>
                <div className="text-sm font-medium">
                  {met ? (
                    <span style={{ color: "var(--success)" }}>✓ 달성</span>
                  ) : (
                    <span style={{ color: "var(--warning)" }}>
                      예상 벌금 {r.projectedPenalty.toLocaleString()}원
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex flex-1 gap-1.5">
                  {Array.from({ length: group.quota }).map((_, i) => (
                    <span
                      key={i}
                      className="h-2.5 flex-1 rounded-full transition-colors"
                      style={{ background: i < r.solved ? "var(--accent)" : "var(--border-strong)" }}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium tabular-nums text-secondary">
                  {r.solved}/{group.quota}
                </span>
              </div>

              {r.weekSolves.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.weekSolves.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1.5 text-xs"
                      style={{ background: "var(--surface-2)", color: "var(--text)" }}
                    >
                      <Link
                        href={`/groups/${groupId}/solve/${s.id}`}
                        className="transition-colors hover:underline"
                        title="정답 코드 보기"
                      >
                        {s.title ?? s.slug}
                        <span className="ml-1.5 text-secondary">
                          {fmtDateTime(s.acceptedAt, group.timezone)}
                        </span>
                      </Link>
                      {isMember && (
                        <CheatReportButton
                          groupId={groupId}
                          solveLogId={s.id}
                          initialReported={reportedByViewer.has(s.id)}
                          initialCount={reportCount.get(s.id) ?? 0}
                          showCount={canSeeReportCount}
                          canReport={r.userId !== viewerId}
                        />
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <section className="mt-14">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">벌금 장부</h2>
          <span className="text-sm text-secondary">
            미납 <b style={{ color: "var(--warning)" }}>{unpaidTotal.toLocaleString()}원</b>
            <span className="ml-1">/ 누적 {totalPenalty.toLocaleString()}원</span>
          </span>
        </div>
        {ledgerByWeek.size === 0 ? (
          <p className="mt-4 text-sm text-secondary">
            아직 마감된 주가 없어요. 매주 일요일 자정에 확정됩니다.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {[...ledgerByWeek.entries()].map(([week, entries]) => (
              <div key={week} className="card p-5">
                <div className="mb-3 text-sm font-semibold text-secondary">{week} 주</div>
                <div className="space-y-2">
                  {entries.map((e) => (
                    <LedgerEntry key={e.id} groupId={groupId} entry={e} quota={group.quota} isOwner={isOwner} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {group.accountNumber ? (
          <div className="mt-4 card p-4 text-sm">
            <div className="text-xs text-secondary">정산 계좌</div>
            <div className="mt-1 font-medium">
              {group.accountBank} {group.accountNumber}
              {group.accountHolder ? <span className="text-secondary"> · {group.accountHolder}</span> : null}
            </div>
          </div>
        ) : null}
        <p className="mt-4 text-xs text-secondary">
          벌금은 장부 표기용입니다. 실제 정산은 위 계좌로 오프라인 송금하세요.
        </p>
      </section>

      {isMember && (
        <>
          {!viewerLinked && (
            <Link
              href="/me"
              className="mt-10 block rounded-2xl border p-4 text-sm"
              style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
            >
              LeetCode가 아직 연동되지 않았어요. <span className="accent font-medium">내 프로필에서 연동하기 →</span>
            </Link>
          )}
          <MemberPanel groupId={groupId} viewerId={viewerId!} />
        </>
      )}
    </main>
  );
}
