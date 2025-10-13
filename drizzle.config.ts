// drizzle.config.ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Ensure one of these is set in your environment:
// - SUPABASE_DB_URL (preferred for Supabase)
// - DATABASE_URL (generic Postgres connection string)
const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  "";

if (!connectionString) {
  // drizzle-kit will surface this at CLI run time
  console.error("Missing database URL. Set SUPABASE_DB_URL or DATABASE_URL in your environment.");
}

export default defineConfig({
  schema: "./lib/drizzle/schema.ts",
  out: "./lib/drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
  verbose: true,
  strict: true,
  // Optional: if you later use introspection, you can filter schemas:
  // schemaFilter: ["public", "auth"],
});