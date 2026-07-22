import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";

export async function currentUserIsAdmin(): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const [u] = await db
    .select({ role: schema.users.role, githubId: schema.users.githubId })
    .from(schema.users)
    .where(eq(schema.users.id, uid))
    .limit(1);
  if (u?.role === "ADMIN") return true;
  return Boolean(u?.githubId && process.env.ADMIN_GITHUB_ID?.trim() === u.githubId);
}
