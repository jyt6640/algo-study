import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";
import { SettingsForm } from "./SettingsForm";
import { GroupAdmin } from "./GroupAdmin";
import { GithubLink } from "./GithubLink";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
  if (!group) notFound();

  const userId = await currentUserId();
  const [membership] = userId
    ? await db
        .select({ role: schema.memberships.role })
        .from(schema.memberships)
        .where(and(eq(schema.memberships.userId, userId), eq(schema.memberships.groupId, groupId)))
        .limit(1)
    : [];

  if (membership?.role !== "OWNER") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-14">
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/groups/${groupId}`} className="text-secondary hover:underline">
            ← 대시보드
          </Link>
          <Link href="/" className="text-secondary hover:underline">
            홈
          </Link>
        </div>
        <p className="mt-6 text-sm text-secondary">방장만 설정을 볼 수 있어요.</p>
      </main>
    );
  }

  const members = await db
    .select({ userId: schema.memberships.userId, nickname: schema.users.nickname, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.groupId, groupId));

  const [installation] = await db
    .select({ installationId: schema.groupGithubInstallations.installationId })
    .from(schema.groupGithubInstallations)
    .where(and(eq(schema.groupGithubInstallations.groupId, groupId), eq(schema.groupGithubInstallations.enabled, true)))
    .limit(1);

  return (
    <main className="rise mx-auto max-w-2xl space-y-5 px-6 py-14">
      <div>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/groups/${groupId}/manage`} className="text-secondary hover:underline">
            ← 관리하기
          </Link>
          <Link href={`/groups/${groupId}`} className="text-secondary hover:underline">
            대시보드
          </Link>
          <Link href="/" className="text-secondary hover:underline">
            홈
          </Link>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">스터디 설정</h1>
      </div>
      <SettingsForm
        groupId={groupId}
        initial={{
          name: group.name,
          active: group.active,
          quota: group.quota,
          periodDays: group.periodDays,
          startDate: group.startDate ?? "",
          endDate: group.endDate ?? "",
          penaltyType: group.penaltyType,
          penaltyAmount: group.penaltyAmount,
          accountBank: group.accountBank ?? "",
          accountNumber: group.accountNumber ?? "",
          accountHolder: group.accountHolder ?? "",
          discordWebhook: group.discordWebhook ?? "",
        }}
      />
      <GithubLink groupId={groupId} repo={group.githubRepo} installationId={installation?.installationId ?? null} />
      <GroupAdmin groupId={groupId} members={members} />
    </main>
  );
}
