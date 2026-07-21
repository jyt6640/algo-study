import { NextRequest } from "next/server";

/** Vercel Cron 은 CRON_SECRET 이 설정돼 있으면 Authorization: Bearer <secret> 를 붙여 호출한다. */
export function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // 로컬은 허용, 프로덕션은 시크릿 필수
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
