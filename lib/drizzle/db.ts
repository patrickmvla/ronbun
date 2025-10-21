import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";

if (!connectionString) {
  throw new Error(
    "Missing database URL. Set SUPABASE_DB_URL or DATABASE_URL in your environment."
  );
}

const isBrowser = typeof window !== "undefined";
if (isBrowser) {
  throw new Error("lib/drizzle/db.ts should only be imported on the server.");
}

// Create a typed global for dev singleton
declare global {
  var __ronbun_pg__: ReturnType<typeof postgres> | undefined;

  var __ronbun_db__: PostgresJsDatabase<typeof schema> | undefined;
}

function createClient() {
  // postgres-js options tuned for server/serverless
  // Increase max to speed up ingest; keep modest to avoid exhausting Supabase limits.
  const max = Number(process.env.PG_MAX || 3); // default 3; override via env if needed
  return postgres(connectionString, {
    ssl: "require",
    max,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

const pg = global.__ronbun_pg__ ?? createClient();
const _db =
  global.__ronbun_db__ ??
  drizzle(pg, { schema, logger: process.env.NODE_ENV === "development" });

if (process.env.NODE_ENV !== "production") {
  global.__ronbun_pg__ = pg;
  global.__ronbun_db__ = _db;
}

export const db = _db;
export { schema };

// Optional: graceful shutdown helper for scripts
export async function closeDb() {
  try {
    await pg.end({ timeout: 5 });
  } catch {
    // ignore
  }
}
