import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUserId } from "@/lib/session";

// 슈퍼관리자 GitHub 로그인 (닉네임은 가입 시 GitHub login 으로 설정됨).
// 환경변수 ADMIN_LOGINS 로 추가 지정 가능 (콤마 구분).
const ADMIN_LOGINS = new Set(
  ["jyt6640", ...(process.env.ADMIN_LOGINS?.split(",") ?? [])].map((s) => s.trim()).filter(Boolean),
);

export function isAdminLogin(login?: string | null): boolean {
  return !!login && ADMIN_LOGINS.has(login);
}

/** 로그인한 사용자가 슈퍼관리자인지 */
export async function currentUserIsAdmin(): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const [u] = await db
    .select({ nickname: schema.users.nickname })
    .from(schema.users)
    .where(eq(schema.users.id, uid))
    .limit(1);
  return isAdminLogin(u?.nickname);
}
