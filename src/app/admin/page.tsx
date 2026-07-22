import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, sql, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserIsAdmin } from "@/lib/admin";
import { AdminRow } from "./AdminRow";

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
    </main>
  );
}
