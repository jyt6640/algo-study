import Link from "next/link";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { auth, signIn, signOut } from "@/auth";
import { db, schema } from "@/db";
import { HomeForms } from "./HomeForms";
import { PlatformLink } from "@/components/PlatformLink";
import { currentUserIsAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-20">
        <div className="rise text-center">
          <h1 className="text-5xl font-semibold tracking-tight">
            7일 <span className="accent">7솔</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-secondary">
            LeetCode와 함께하는 알고리즘 스터디. 매주 7문제, 못 채우면 벌금이 장부에 남습니다.
            마감은 매주 일요일 자정.
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/" });
            }}
            className="mt-10"
          >
            <button className="btn btn-primary mx-auto text-base">
              <GitHubMark /> GitHub로 시작하기
            </button>
          </form>
          <p className="mt-4 text-sm text-secondary">
            로그인하면 참여한 스터디에 언제든 다시 들어올 수 있어요.
          </p>
        </div>
      </main>
    );
  }

  const userId = Number(session.user.id);
  const studies = await db
    .select({
      groupId: schema.groups.id,
      name: schema.groups.name,
      inviteCode: schema.groups.inviteCode,
      role: schema.memberships.role,
    })
    .from(schema.memberships)
    .innerJoin(schema.groups, eq(schema.groups.id, schema.memberships.groupId))
    .where(eq(schema.memberships.userId, userId));

  // 둘러보기: 내가 안 든 활성 스터디 (멤버 수 포함)
  const myGroupIds = studies.map((s) => s.groupId);
  const discover = await db
    .select({
      groupId: schema.groups.id,
      name: schema.groups.name,
      quota: schema.groups.quota,
      memberCount: sql<number>`count(${schema.memberships.id})::int`,
    })
    .from(schema.groups)
    .leftJoin(schema.memberships, eq(schema.memberships.groupId, schema.groups.id))
    .where(
      myGroupIds.length
        ? and(eq(schema.groups.active, true), notInArray(schema.groups.id, myGroupIds))
        : eq(schema.groups.active, true),
    )
    .groupBy(schema.groups.id)
    .orderBy(sql`count(${schema.memberships.id}) desc`)
    .limit(20);

  const [me] = await db
    .select({ leetcode: schema.users.leetcodeHandle, programmers: schema.users.programmersHandle })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  const linked = Boolean(me?.leetcode || me?.programmers);
  const admin = await currentUserIsAdmin();

  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">
          7일 <span className="accent">7솔</span>
        </h1>
        <div className="flex items-center gap-3">
          <Link href="/me" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-[var(--surface-2)]">
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" className="h-8 w-8 rounded-full" />
            )}
            <span className="text-sm font-medium">{session.user.name}</span>
          </Link>
          {admin && (
            <Link href="/admin" className="text-sm accent hover:underline">
              관리자
            </Link>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="text-sm text-secondary hover:underline">로그아웃</button>
          </form>
        </div>
      </header>

      {!linked && (
        <section className="rise mt-8">
          <div
            className="mb-4 rounded-xl px-4 py-3 text-sm"
            style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}
          >
            먼저 <b>LeetCode 또는 프로그래머스</b>를 연동하세요. 둘 중 하나는 연동해야 풀이가 집계돼요.
          </div>
          <PlatformLink />
        </section>
      )}

      <section className="rise mt-10">
        <h2 className="text-xl font-semibold">내 스터디</h2>
        {studies.length === 0 ? (
          <p className="mt-3 text-sm text-secondary">
            아직 참여한 스터디가 없어요. 아래에서 새로 만들거나 초대코드로 참여하세요.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {studies.map((s) => (
              <Link
                key={s.groupId}
                href={`/groups/${s.groupId}`}
                className="card flex items-center justify-between p-4 transition hover:brightness-105"
              >
                <div className="flex items-center gap-2 font-medium">
                  {s.name}
                  {s.role === "OWNER" && <span className="accent text-xs">방장</span>}
                </div>
                <span className="text-sm text-secondary">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {discover.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">둘러보기</h2>
          <p className="mt-1 text-sm text-secondary">
            지금 활성화된 스터디예요. 참여하려면 멤버에게 <b>초대코드</b>를 받아 아래에서 입력하세요.
          </p>
          <div className="mt-4 space-y-2">
            {discover.map((d) => (
              <Link
                key={d.groupId}
                href={`/groups/${d.groupId}`}
                className="card flex items-center justify-between p-4 transition hover:brightness-105"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.name}</div>
                  <div className="text-xs text-secondary">
                    멤버 {d.memberCount}명 · 주 {d.quota}솔
                  </div>
                </div>
                <span className="text-sm text-secondary">운영 방식 →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <HomeForms />
      </section>
    </main>
  );
}

function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
