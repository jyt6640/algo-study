import Link from "next/link";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { currentPeriod } from "@/lib/week";
import { calcPenalty } from "@/lib/penalty";
import { currentUserId } from "@/lib/session";
import { currentUserIsAdmin } from "@/lib/admin";
import { getMembership } from "@/lib/membership";
import { LedgerEntry } from "../LedgerEntry";
import { DeleteSolveButton } from "@/components/DeleteSolveButton";

export const dynamic = "force-dynamic";

export default async function ManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
  if (!group) notFound();

  const userId = await currentUserId();
  const membership = await getMembership(userId, groupId);
  const admin = await currentUserIsAdmin();
  const isOwner = membership?.role === "OWNER";
  if (!isOwner && !admin) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-14">
        <Link href={`/groups/${groupId}`} className="text-sm text-secondary hover:underline">
          ← 대시보드
        </Link>
        <p className="mt-6 text-sm text-secondary">방장만 볼 수 있는 페이지예요.</p>
      </main>
    );
  }

  const { start, end, notStarted, ended } = currentPeriod(new Date(), group);

  const members = await db
    .select({ userId: schema.memberships.userId, nickname: schema.users.nickname, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.groupId, groupId));

  // 이번 기간 멤버별 풀이 (신고 매핑 + 예상 벌금)
  const solveToMember = new Map<number, number>();
  const solveTitle = new Map<number, string>();
  const memberNick = new Map<number, string>();
  let periodPenaltyTotal = 0;
  let behindCount = 0;
  for (const m of members) memberNick.set(m.userId, m.nickname);

  const periodSolveIds: number[] = [];
  for (const m of members) {
    const weekSolves = await db
      .select({ id: schema.solveLogs.id, slug: schema.solveLogs.problemSlug, title: schema.solveLogs.problemTitle })
      .from(schema.solveLogs)
      .where(
        and(
          eq(schema.solveLogs.userId, m.userId),
          gte(schema.solveLogs.acceptedAt, start),
          lt(schema.solveLogs.acceptedAt, end),
        ),
      );
    for (const s of weekSolves) {
      solveToMember.set(s.id, m.userId);
      solveTitle.set(s.id, s.title ?? s.slug);
      periodSolveIds.push(s.id);
    }
    const solved = weekSolves.length;
    const pen = calcPenalty(group.penaltyType, group.penaltyAmount, group.quota, solved);
    periodPenaltyTotal += pen;
    if (solved < group.quota) behindCount += 1;
  }

  // 익명 신고 집계 (신고자 신원은 조회하지 않음)
  type SolveReport = { solveLogId: number; memberId: number; memberNickname: string; title: string; reasons: Array<string | null>; count: number };
  const reportsBySolve = new Map<number, SolveReport>();
  if (periodSolveIds.length) {
    const details = await db
      .select({
        solveLogId: schema.cheatReports.solveLogId,
        reason: schema.cheatReports.reason,
        createdAt: schema.cheatReports.createdAt,
      })
      .from(schema.cheatReports)
      .where(inArray(schema.cheatReports.solveLogId, periodSolveIds))
      .orderBy(desc(schema.cheatReports.createdAt));
    for (const d of details) {
      const uid = solveToMember.get(d.solveLogId);
      if (!uid) continue;
      if (!reportsBySolve.has(d.solveLogId)) {
        reportsBySolve.set(d.solveLogId, {
          solveLogId: d.solveLogId,
          memberId: uid,
          memberNickname: memberNick.get(uid) ?? "",
          title: solveTitle.get(d.solveLogId) ?? "",
          reasons: [],
          count: 0,
        });
      }
      const r = reportsBySolve.get(d.solveLogId)!;
      r.count += 1;
      r.reasons.push(d.reason);
    }
  }
  const reportedSolves = [...reportsBySolve.values()];

  // 벌금 장부
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
  const owed = ledger.filter((l) => !l.exempt && l.penaltyAmount > 0);
  const totalPenalty = owed.reduce((s, l) => s + l.penaltyAmount, 0);
  const unpaidTotal = owed.filter((l) => !l.paid).reduce((s, l) => s + l.penaltyAmount, 0);

  const stat = (label: string, value: string, color?: string) => (
    <div className="card p-4">
      <div className="text-xs text-secondary">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/groups/${groupId}`} className="text-secondary hover:underline">
            ← 대시보드
          </Link>
          <Link href="/" className="text-secondary hover:underline">
            홈
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/groups/${groupId}/activity`} className="text-secondary hover:underline">
            활동
          </Link>
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
          {isOwner && (
            <Link href={`/groups/${groupId}/settings`} className="accent hover:underline">
              설정
            </Link>
          )}
        </div>
      </div>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">방장 대시보드</h1>
      <p className="mt-1 text-sm text-secondary">{group.name} 운영 현황을 한눈에.</p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat("멤버", `${members.length}명`)}
        {stat(
          "이번 기간 예상 벌금",
          notStarted || ended ? "—" : `${periodPenaltyTotal.toLocaleString()}원`,
          periodPenaltyTotal > 0 ? "var(--warning)" : "var(--success)",
        )}
        {stat("치팅 신고", `${reportedSolves.length}건`, reportedSolves.length ? "var(--danger)" : undefined)}
        {stat("미입금 벌금", `${unpaidTotal.toLocaleString()}원`, unpaidTotal ? "var(--warning)" : "var(--success)")}
      </div>

      {isOwner && (
        <div className="mt-3 card flex items-center justify-between p-4">
          <div className="text-xs text-secondary">초대코드</div>
          <div className="accent font-mono text-lg font-semibold tracking-widest">{group.inviteCode}</div>
        </div>
      )}

      {/* 익명 신고 검토 */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">🚩 신고 검토</h2>
          <span className="text-sm text-secondary">{reportedSolves.length}건 · 익명</span>
        </div>
        <p className="mt-1 text-xs text-secondary">
          신고자는 <b>익명</b>이며 방장에게만 보여요. 검토 후 문제가 있으면 해당 풀이를 취소(삭제)할 수 있어요.
        </p>
        {reportedSolves.length === 0 ? (
          <p className="mt-4 text-sm text-secondary">아직 신고된 풀이가 없어요.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {reportedSolves.map((rep) => (
              <div key={rep.solveLogId} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/groups/${groupId}/solve/${rep.solveLogId}`} className="font-semibold hover:underline">
                      {rep.title}
                    </Link>
                    <span className="ml-2 text-sm text-secondary">· {rep.memberNickname}</span>
                    <span
                      className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)" }}
                    >
                      신고 {rep.count}건
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/groups/${groupId}/solve/${rep.solveLogId}`}
                      className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-[var(--surface-2)]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      코드 보기
                    </Link>
                    <DeleteSolveButton
                      groupId={groupId}
                      solveId={rep.solveLogId}
                      label="풀이 취소"
                      confirmText={`'${rep.title}' 풀이를 취소(삭제)할까요? 이 멤버의 카운트에서 제외되고 코드도 삭제됩니다.`}
                      variant="danger"
                    />
                  </div>
                </div>
                {rep.reasons.some((r) => r) && (
                  <div className="mt-3 space-y-1.5 border-t pt-3 text-xs" style={{ borderColor: "var(--border)" }}>
                    {rep.reasons.map((rr, i) => (
                      <div key={i} className="text-secondary">
                        {rr ? `“${rr}”` : "(사유 없음)"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 벌금 장부 */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">벌금 장부</h2>
          <span className="text-sm text-secondary">
            미입금 <b style={{ color: "var(--warning)" }}>{unpaidTotal.toLocaleString()}원</b>
            <span className="ml-1">/ 누적 {totalPenalty.toLocaleString()}원</span>
          </span>
        </div>
        {ledgerByWeek.size === 0 ? (
          <p className="mt-4 text-sm text-secondary">아직 마감된 기간이 없어요. 기간이 끝나면 벌금이 확정됩니다.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {[...ledgerByWeek.entries()].map(([week, entries]) => (
              <div key={week} className="card p-5">
                <div className="mb-3 text-sm font-semibold text-secondary">{week} 기간</div>
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
        <p className="mt-3 text-xs text-secondary">
          벌금 입금을 받았으면 각 항목의 <b>입금 확인</b>을 눌러 처리하세요. 실제 송금은 오프라인입니다.
        </p>
      </section>

      {isOwner && (
        <div className="mt-12 flex flex-wrap gap-2 text-sm">
          <Link href={`/groups/${groupId}/settings`} className="btn btn-secondary !px-4 !py-2">
            규칙·멤버·계좌·GitHub 설정 →
          </Link>
        </div>
      )}
    </main>
  );
}
