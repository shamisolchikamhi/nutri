import { defineConfig } from "drizzle-kit";
import path from "path";

const requiresDatabase = process.argv.some((argument) => argument === "migrate" || argument === "push");

if (requiresDatabase && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://unused:unused@127.0.0.1:1/unused",
  },
});
