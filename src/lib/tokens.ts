import { createHash, randomBytes } from "node:crypto";
import { customAlphabet } from "nanoid";

/** 사람이 공유하기 쉬운 초대 코드 (헷갈리는 글자 제외) */
export const generateInviteCode = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 6);

/** 확장 연동 토큰 발급: 원문은 1회만 보여주고, DB에는 해시만 저장 */
export function issueExtensionToken(): { raw: string; hash: string } {
  const raw = randomBytes(24).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
