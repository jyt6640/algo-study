import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 홈 디렉터리의 다른 lockfile 때문에 루트를 오인하지 않도록 고정
  outputFileTracingRoot: __dirname,
  // 확장프로그램(chrome-extension://) 에서 /api/ingest 를 호출할 수 있도록 CORS 허용
  async headers() {
    const cors = [
      { key: "Access-Control-Allow-Origin", value: "*" },
      { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
      { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
    ];
    return [
      { source: "/api/ingest", headers: cors },
      { source: "/api/link", headers: cors },
    ];
  },
};

export default nextConfig;
