import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { fetchFullProfile } from "@/lib/leetcode";
import { ProfileCard } from "@/components/ProfileCard";
import { LeetCodeLink } from "@/components/LeetCodeLink";

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

      {profile ? (
        <div className="mt-8">
          <ProfileCard profile={profile} />
        </div>
      ) : (
        <LeetCodeLink />
      )}

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

      {profile && (
        <p className="mt-8 text-xs text-secondary">
          LeetCode 계정을 바꾸려면 스터디 대시보드의 &quot;LeetCode 연동&quot;에서 다시 입력하세요.
        </p>
      )}
    </main>
  );
}
