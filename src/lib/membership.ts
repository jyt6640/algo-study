import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** 유저의 그룹 멤버십(역할) 반환. 미로그인/비멤버면 null. */
export async function getMembership(userId: number | null, groupId: number) {
  if (!userId) return null;
  const [m] = await db
    .select({ role: schema.memberships.role })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, userId), eq(schema.memberships.groupId, groupId)))
    .limit(1);
  return m ?? null;
}
