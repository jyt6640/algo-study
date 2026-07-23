import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { fetchFullProfile } from "@/lib/leetcode";
import { combineHeatmap } from "@/lib/format";
import { ProfileCard } from "@/components/ProfileCard";
import { Heatmap } from "@/components/Heatmap";
import { PlatformLink } from "@/components/PlatformLink";
import { RefreshButton } from "./RefreshButton";
import { Tokens } from "./Tokens";
import { ImportCode } from "@/components/ImportCode";
import { NicknameEditor } from "@/components/NicknameEditor";

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

  const allSolves = await db
    .select({ acceptedAt: schema.solveLogs.acceptedAt, platform: schema.solveLogs.platform })
    .from(schema.solveLogs)
    .where(eq(schema.solveLogs.userId, userId));
  const pgDates = allSolves.filter((s) => s.platform === "PROGRAMMERS").map((s) => s.acceptedAt);
  const { total: combinedCal, breakdown: combinedBreak } = combineHeatmap(profile?.calendar, pgDates, user.timezone);
  const lcCount = profile?.solved.all ?? allSolves.filter((s) => s.platform === "LEETCODE").length;
  const pgCount = pgDates.length;

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
          <h1 className="text-3xl font-semibold tracking-tight">{user.nickname}</h1>
          {user.githubLogin && <p className="text-sm text-secondary">GitHub @{user.githubLogin}</p>}
        </div>
      </div>

      <section className="card mt-6 p-6">
        <div className="text-sm font-semibold">닉네임</div>
        <p className="mb-3 mt-0.5 text-xs text-secondary">스터디에서 이 이름으로 표시돼요.</p>
        <NicknameEditor initial={user.nickname} />
      </section>

      {user.leetcodeHandle && (
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <ImportCode />
          <RefreshButton />
        </div>
      )}

      {profile && (
        <div className="mt-3">
          <ProfileCard profile={profile} showHeatmap={false} />
        </div>
      )}

      {allSolves.length > 0 && (
        <section className="card mt-6 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">잔디밭 🌱</div>
            <div className="flex gap-3 text-xs text-secondary">
              <span>리트코드 {lcCount}</span>
              <span>프로그래머스 {pgCount}</span>
            </div>
          </div>
          <p className="mb-3 mt-1 text-xs text-secondary">칸에 마우스를 올리면 플랫폼별 개수가 보여요.</p>
          <Heatmap calendar={combinedCal} breakdown={combinedBreak} />
        </section>
      )}

      {/* 연동: 미연동이면 펼쳐서 유도, 이미 연동됐으면 접어둠 */}
      <details className="mt-8" open={!linked}>
        <summary className="cursor-pointer text-sm font-semibold">플랫폼 연동 관리</summary>
        <div className="mt-3">
          <PlatformLink />
        </div>
      </details>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold">확장 연동 토큰 관리</summary>
        <Tokens />
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
