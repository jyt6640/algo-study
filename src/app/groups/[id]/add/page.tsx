import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { getMembership } from "@/lib/membership";
import { MembersOnly } from "@/components/MembersOnly";
import { ManualSolveForm } from "./ManualSolveForm";

export const dynamic = "force-dynamic";

export default async function AddSolvePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const [group] = await db
    .select({ name: schema.groups.name })
    .from(schema.groups)
    .where(eq(schema.groups.id, groupId))
    .limit(1);
  if (!group) notFound();

  const viewerId = await currentUserId();
  if (!(await getMembership(viewerId, groupId))) return <MembersOnly groupId={groupId} />;

  return (
    <main className="rise mx-auto max-w-2xl px-6 py-14">
      <div className="flex items-center gap-3 text-sm">
        <Link href={`/groups/${groupId}`} className="text-secondary hover:underline">
          ← {group.name}
        </Link>
        <Link href="/" className="text-secondary hover:underline">
          홈
        </Link>
      </div>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">문제 직접 추가</h1>
      <p className="mt-2 text-sm text-secondary">
        책이나 오프라인에서 푼 문제처럼 LeetCode·프로그래머스에 없는 문제를 직접 기입해요. 제목만 있어도 등록되고,
        문제 내용과 코드는 선택입니다.
      </p>

      <ManualSolveForm groupId={groupId} />
    </main>
  );
}
