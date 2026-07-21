import { and, eq, gte, lt, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { weekBounds } from "@/lib/week";
import { calcPenalty } from "@/lib/penalty";

export const dynamic = "force-dynamic";

export default async function GroupDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
  if (!group) notFound();

  const { start, end, weekOf } = weekBounds(new Date(), group.timezone);

  const members = await db
    .select({ userId: schema.memberships.userId, nickname: schema.users.nickname, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.groupId, groupId));

  const rows = await Promise.all(
    members.map(async (m) => {
      const [{ cnt }] = await db
        .select({ cnt: sql<number>`count(distinct ${schema.solveLogs.problemSlug})::int` })
        .from(schema.solveLogs)
        .where(
          and(
            eq(schema.solveLogs.userId, m.userId),
            gte(schema.solveLogs.acceptedAt, start),
            lt(schema.solveLogs.acceptedAt, end),
          ),
        );
      const solved = cnt ?? 0;
      return {
        ...m,
        solved,
        projectedPenalty: calcPenalty(group.penaltyType, group.penaltyAmount, group.quota, solved),
      };
    }),
  );
  rows.sort((a, b) => b.solved - a.solved);

  const msLeft = end.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.floor(msLeft / 86400000));
  const hoursLeft = Math.max(0, Math.floor((msLeft % 86400000) / 3600000));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="mt-1 text-sm text-neutral-400">
            이번 주 ({weekOf} 시작) · 마감까지 <b className="text-neutral-200">{daysLeft}일 {hoursLeft}시간</b>
          </p>
        </div>
        <div className="rounded-lg border border-neutral-800 px-3 py-2 text-right text-sm">
          <div className="text-neutral-400">초대코드</div>
          <div className="font-mono text-lg font-bold tracking-widest text-emerald-400">{group.inviteCode}</div>
        </div>
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        목표 {group.quota}솔 · 벌금 {group.penaltyType === "FIXED" ? "미달 시" : "부족 문제당"}{" "}
        {group.penaltyAmount.toLocaleString()}원
      </p>

      <div className="mt-8 space-y-3">
        {rows.map((r) => (
          <div key={r.userId} className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                {r.nickname}
                {r.role === "OWNER" && <span className="ml-2 text-xs text-emerald-400">방장</span>}
              </div>
              <div className="text-sm">
                {r.solved >= group.quota ? (
                  <span className="text-emerald-400">달성 ✓</span>
                ) : (
                  <span className="text-amber-400">예상 벌금 {r.projectedPenalty.toLocaleString()}원</span>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex gap-1">
                {Array.from({ length: group.quota }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-4 w-4 rounded ${i < r.solved ? "bg-emerald-500" : "bg-neutral-700"}`}
                  />
                ))}
              </div>
              <span className="ml-2 text-sm tabular-nums text-neutral-300">
                {r.solved}/{group.quota}
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
