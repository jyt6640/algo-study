import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { weekBounds } from "@/lib/week";
import { fetchFullProfile } from "@/lib/leetcode";
import { Heatmap } from "./Heatmap";

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

  // 연동돼 있으면 LeetCode 프로필 + 잔디 데이터
  const profile = user.leetcodeHandle
    ? await fetchFullProfile(user.leetcodeHandle).catch(() => null)
    : null;

  return (
    <main className="rise mx-auto max-w-2xl px-6 py-14">
      <Link href={`/groups/${groupId}`} className="text-sm text-secondary hover:underline">
        ← {group.name}
      </Link>

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
        {" · "}이번 주 {thisWeekCount}/{group.quota} · 누적 {solves.length}솔
      </p>

      {profile && (
        <section className="card mt-8 p-6">
          <div className="flex items-center gap-4">
            {profile.avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar} alt="" className="h-14 w-14 rounded-full" />
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                @{profile.username}
                {profile.realName ? <span className="text-secondary"> · {profile.realName}</span> : null}
              </div>
              <div className="text-sm text-secondary">
                {profile.ranking ? `랭킹 ${profile.ranking.toLocaleString()} · ` : ""}
                {profile.solved.all.toLocaleString()}문제 해결
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            <Stat label="전체" value={profile.solved.all} />
            <Stat label="Easy" value={profile.solved.easy} color="var(--success)" />
            <Stat label="Medium" value={profile.solved.medium} color="var(--warning)" />
            <Stat label="Hard" value={profile.solved.hard} color="var(--danger)" />
            <Stat label="연속" value={profile.streak} suffix="일" />
            <Stat label="활동일" value={profile.totalActiveDays} suffix="일" />
          </div>

          <div className="mt-6">
            <div className="mb-2 text-sm font-semibold">잔디밭 🌱</div>
            <Heatmap calendar={profile.calendar} />
          </div>
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
                  <a
                    href={`https://leetcode.com/problems/${s.problemSlug}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium hover:underline"
                  >
                    {s.problemTitle ?? s.problemSlug}
                  </a>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-secondary">
                    {inWeek && (
                      <span
                        className="rounded-full px-2 py-0.5"
                        style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}
                      >
                        이번 주
                      </span>
                    )}
                    <span
                      className="rounded-full px-2 py-0.5"
                      style={{ background: "var(--surface-2)" }}
                    >
                      {sourceLabel[s.source]}
                    </span>
                    <span>{s.acceptedAt.toISOString().slice(0, 10)}</span>
                  </div>
                </div>
                {code && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-secondary hover:underline">
                      코드 보기 {code.language ? `(${code.language})` : ""}
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
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: number;
  suffix?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl p-2" style={{ background: "var(--surface-2)" }}>
      <div className="text-lg font-semibold tabular-nums" style={color ? { color } : undefined}>
        {value.toLocaleString()}
        {suffix ? <span className="text-xs font-normal text-secondary">{suffix}</span> : null}
      </div>
      <div className="text-xs text-secondary">{label}</div>
    </div>
  );
}
