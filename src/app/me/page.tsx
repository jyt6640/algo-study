import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { fetchFullProfile } from "@/lib/leetcode";
import { solvesToCalendar } from "@/lib/format";
import { ProfileCard } from "@/components/ProfileCard";
import { Heatmap } from "@/components/Heatmap";
import { PlatformLink } from "@/components/PlatformLink";

export const dynamic = "force-dynamic";

export default async function MyProfile() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = Number(session.user.id);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) redirect("/");

  const studies = await db
    .select({ groupId: schema.groups.id, name: schema.groups.name, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.groups, eq(schema.groups.id, schema.memberships.groupId))
    .where(eq(schema.memberships.userId, userId));

  const profile = user.leetcodeHandle
    ? await fetchFullProfile(user.leetcodeHandle).catch(() => null)
    : null;

  const pgSolves = await db
    .select({ acceptedAt: schema.solveLogs.acceptedAt })
    .from(schema.solveLogs)
    .where(and(eq(schema.solveLogs.userId, userId), eq(schema.solveLogs.platform, "PROGRAMMERS")));
  const pgCalendar = solvesToCalendar(
    pgSolves.map((s) => s.acceptedAt),
    user.timezone,
  );

  const linked = Boolean(user.leetcodeHandle || user.programmersHandle);

  return (
    <main className="rise mx-auto max-w-2xl px-6 py-14">
      <Link href="/" className="text-sm text-secondary hover:underline">
        ← 홈
      </Link>

      <div className="mt-4 flex items-center gap-4">
        {user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-16 w-16 rounded-full" />
        )}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{user.name ?? user.nickname}</h1>
          <p className="text-sm text-secondary">@{user.nickname}</p>
        </div>
      </div>

      {profile && (
        <div className="mt-8">
          <ProfileCard profile={profile} />
        </div>
      )}

      {pgSolves.length > 0 && (
        <section className="card mt-6 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">프로그래머스</h2>
            <span className="text-sm text-secondary">
              스터디 집계 <b style={{ color: "var(--text)" }}>{pgSolves.length}</b>문제
            </span>
          </div>
          <div className="mt-4">
            <div className="mb-2 text-sm font-semibold">잔디밭 🌱</div>
            <Heatmap calendar={pgCalendar} />
          </div>
        </section>
      )}

      {/* 연동: 미연동이면 펼쳐서 유도, 이미 연동됐으면 접어둠 */}
      <details className="mt-8" open={!linked}>
        <summary className="cursor-pointer text-sm font-semibold">플랫폼 연동 관리</summary>
        <div className="mt-3">
          <PlatformLink />
        </div>
      </details>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">내 스터디</h2>
        {studies.length === 0 ? (
          <p className="mt-3 text-sm text-secondary">아직 참여한 스터디가 없어요.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {studies.map((s) => (
              <Link
                key={s.groupId}
                href={`/groups/${s.groupId}`}
                className="card flex items-center justify-between p-4 transition hover:brightness-105"
              >
                <span className="flex items-center gap-2 font-medium">
                  {s.name}
                  {s.role === "OWNER" && <span className="accent text-xs">방장</span>}
                </span>
                <span className="text-sm text-secondary">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
