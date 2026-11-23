import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  member: vi.fn(() => true),
  append: vi.fn(() => ({ solveId: 11, isNew: true, codeSaved: true })),
}));

vi.mock("@/lib/session", () => ({ currentUserId: () => 5 }));
vi.mock("@/lib/membership", () => ({ getMembership: mocks.member }));
vi.mock("@/lib/ledger", () => ({
  appendSubmissionEvent: mocks.append,
  ensureTransaction: (action: (tx: object) => Promise<unknown>) => action({}),
}));

function register(problem: string, acceptedAt: string) {
  const request = new NextRequest("http://localhost/api/groups/8/manual-solve", {
    method: "POST",
    body: JSON.stringify({ platform: "BOJ", problem, acceptedAt, code: "my code" }),
  });
  return POST(request, { params: Promise.resolve({ id: "8" }) });
}

beforeEach(() => {
  mocks.member.mockReset().mockReturnValue(true);
  mocks.append.mockClear();
});

describe("백준 스터디 등록 API", () => {
  it("같은 문제를 다른 날짜에 재전송해도 같은 원장 키를 사용한다", async () => {
    const first = await register("https://acmicpc.net/problem/1000", "2026-11-22T00:00:00Z");
    const second = await register("1000", "2026-11-23T00:00:00Z");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.append).toHaveBeenCalledTimes(2);
    expect(mocks.append).toHaveBeenCalledWith({}, expect.objectContaining({
      userId: 5,
      problemSlug: "1000",
      problemTitle: "백준 1000번",
      verificationLevel: "MANUAL_PENDING",
      eventKey: "5:BOJ:1000:MANUAL",
    }));
    expect(mocks.append).toHaveBeenNthCalledWith(2, {}, expect.objectContaining({ eventKey: "5:BOJ:1000:MANUAL" }));
  });

  it("비회원과 유효하지 않은 링크는 저장 전에 차단한다", async () => {
    mocks.member.mockReturnValueOnce(false);
    expect((await register("1000", "2026-11-23T00:00:00Z")).status).toBe(403);
    expect((await register("https://example.com/problem/1000", "2026-11-23T00:00:00Z")).status).toBe(400);
    expect(mocks.append).not.toHaveBeenCalled();
  });
});
