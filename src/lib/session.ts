import { auth } from "@/auth";

/** 로그인한 사용자의 DB user id. 미로그인 시 null. */
export async function currentUserId(): Promise<number | null> {
  const session = await auth();
  const id = session?.user?.id;
  return id ? Number(id) : null;
}
