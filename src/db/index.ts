import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

type DB = NeonDatabase<typeof schema>;

// 지연 초기화: 빌드 시점(모듈 로드)엔 DATABASE_URL 을 요구하지 않고,
// 실제 쿼리가 실행되는 런타임 첫 접근에만 연결을 만든다.
let _db: DB | null = null;

function getDb(): DB {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }
  const pool = new Pool({ connectionString: url });
  _db = drizzle({ client: pool, schema });
  return _db;
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

export { schema };
