import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, sql, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserIsAdmin } from "@/lib/admin";
import { AdminRow } from "./AdminRow";
import { NicknameEditor } from "@/components/NicknameEditor";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await currentUserIsAdmin())) redirect("/");

  const groups = await db
    .select({
      id: schema.groups.id,
      name: schema.groups.name,
      active: schema.groups.active,
      quota: schema.groups.quota,
      createdAt: schema.groups.createdAt,
      memberCount: sql<number>`count(${schema.memberships.id})::int`,
    })
    .from(schema.groups)
    .leftJoin(schema.memberships, eq(schema.memberships.groupId, schema.groups.id))
    .groupBy(schema.groups.id)
    .orderBy(desc(schema.groups.createdAt));

  const users = await db
    .select({
      id: schema.users.id,
      nickname: schema.users.nickname,
      githubLogin: schema.users.githubLogin,
      leetcode: schema.users.leetcodeHandle,
      programmers: schema.users.programmersHandle,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt));

  return (
    <main className="rise mx-auto max-w-2xl px-6 py-14">
      <Link href="/" className="text-sm text-secondary hover:underline">
        ← 홈
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">관리자</h1>
      <p className="mt-2 text-sm text-secondary">모든 스터디 {groups.length}개. 활성화 토글·삭제 가능.</p>

      <div className="mt-6 space-y-2">
        {groups.map((g) => (
          <AdminRow key={g.id} group={g} />
        ))}
      </div>

      <h2 className="mt-14 text-xl font-semibold">사용자 {users.length}명</h2>
      <p className="mt-1 text-sm text-secondary">닉네임을 직접 변경할 수 있어요.</p>
      <div className="mt-4 space-y-2">
        {users.map((u) => (
          <div key={u.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0 text-sm">
              <div className="font-medium">{u.nickname}</div>
              <div className="text-xs text-secondary">
                {u.githubLogin ? `GitHub @${u.githubLogin}` : `#${u.id}`}
                {u.leetcode ? ` · LC ${u.leetcode}` : ""}
                {u.programmers ? ` · PG ${u.programmers}` : ""}
              </div>
            </div>
            <NicknameEditor initial={u.nickname} userId={u.id} compact />
          </div>
        ))}
      </div>
    </main>
  );
}
