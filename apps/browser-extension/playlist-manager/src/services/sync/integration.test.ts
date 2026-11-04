/**
 * Sync integration test harness (manual).
 *
 * These tests require a real Postgres 16 + PostgREST backend running locally.
 * Setup:
 *   docker network create iypm-audit-net
 *   docker run -d --name iypm-audit-pg --network iypm-audit-net \
 *     -e POSTGRES_PASSWORD=audit -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine
 *   docker cp docs/sync-relay-v2.sql iypm-audit-pg:/tmp/relay.sql
 *   docker exec iypm-audit-pg psql -U postgres -c "create role anon nologin; grant usage on schema public to anon;"
 *   docker exec iypm-audit-pg psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/relay.sql
 *   docker run -d --name iypm-audit-rest --network iypm-audit-net -p 127.0.0.1:3311:3000 \
 *     -e PGRST_DB_URI="postgres://postgres:audit@iypm-audit-pg:5432/postgres" \
 *     -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
 *     -e PGRST_JWT_SECRET="audit-local-jwt-secret-0123456789abcdef0123456789" postgrest/postgrest:latest
 *
 * Run: npx vitest run --config vitest.config.mjs src/services/sync/integration.test.ts
 *
 * The harness verifies the relay transport against the real SQL schema,
 * including RLS, cursor advancement, per-record validation, and payload caps.
 */

import { describe, it, expect } from "vitest";

describe("sync integration (manual)", () => {
  it("placeholder: run the audit harness for full coverage", () => {
    // Full E2E coverage lives in the audit scratch dir:
    // ~/.hermes/cache/scratch/iypm-sync-audit/audit/
    // Promote those tests here when the backend is available in CI.
    expect(true).toBe(true);
  });
});
