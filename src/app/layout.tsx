import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "7일 7솔 — 알고리즘 스터디",
  description: "LeetCode 연동. 매주 7문제 못 풀면 벌금.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
