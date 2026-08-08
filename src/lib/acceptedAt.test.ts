import { describe, it, expect } from "vitest";
import { acceptedAtISO } from "./acceptedAt";

describe("acceptedAtISO (직접 추가 시각 = 작성 시각)", () => {
  const now = new Date("2026-08-08T14:23:45.000Z");

  it("오늘 날짜면 현재 시각 그대로", () => {
    const iso = acceptedAtISO("2026-08-08", now);
    expect(iso).toBe("2026-08-08T14:23:45.000Z");
  });

  it("과거 날짜여도 정오가 아니라 현재 시:분:초 유지", () => {
    const iso = acceptedAtISO("2026-08-01", now);
    const d = new Date(iso);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(7); // 8월
    expect(d.getUTCDate()).toBe(1);
    expect(iso.slice(11)).toBe("14:23:45.000Z"); // 12:00 이 아님
  });

  it("날짜가 비면 현재 시각", () => {
    expect(acceptedAtISO("", now)).toBe(now.toISOString());
  });

  it("잘못된 날짜면 현재 시각", () => {
    expect(acceptedAtISO("not-a-date", now)).toBe(now.toISOString());
  });
});
