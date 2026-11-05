import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SYNC_RELAY_V2_SQL } from "./sync-relay-schema-sql";

function stripCommentsAndNormalize(sql: string): string {
  return sql
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("SYNC_RELAY_V2_SQL schema contract", () => {
  it("matches docs/sync-relay-v2.sql executable SQL statements byte-for-byte", () => {
    const repoRoot = path.resolve(__dirname, "../../../../../..");
    const canonicalSql = fs.readFileSync(path.join(repoRoot, "docs/sync-relay-v2.sql"), "utf8");
    expect(stripCommentsAndNormalize(SYNC_RELAY_V2_SQL)).toBe(
      stripCommentsAndNormalize(canonicalSql)
    );
  });
});
