import { describe, it, expect } from "vitest";
import { validateBackupSchema } from "./backup-service";

describe("validateBackupSchema", () => {
  it("validates a correct schemaVersion 2 backup", () => {
    const backup = {
      format: "yph_full_backup",
      schemaVersion: 2,
      exportedAt: "2025-01-01T00:00:00.000Z",
      metadata: { appVersion: "1.0.0" },
      data: { playlists: [], videoMetadata: {}, history: {}, settings: {} },
    };
    const result = validateBackupSchema(backup);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.schemaVersion).toBe(2);
  });

  it("validates a legacy array (schemaVersion 1)", () => {
    const result = validateBackupSchema([{ id: "p1", title: "Test" }]);
    expect(result.valid).toBe(true);
    expect(result.schemaVersion).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("returns valid for a correct schemaVersion 1 object", () => {
    const backup = {
      format: "yph_full_backup",
      schemaVersion: 1,
      data: { playlists: [] },
    };
    const result = validateBackupSchema(backup);
    expect(result.valid).toBe(true);
    expect(result.schemaVersion).toBe(1);
  });

  it("rejects null input", () => {
    const result = validateBackupSchema(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.schemaVersion).toBe(0);
  });

  it("rejects undefined input", () => {
    const result = validateBackupSchema(undefined);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
  });

  it("rejects an empty object", () => {
    const result = validateBackupSchema({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects wrong format string", () => {
    const backup = { format: "wrong_format", schemaVersion: 2, data: {} };
    const result = validateBackupSchema(backup);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Unrecognized backup format"))).toBe(true);
  });

  it("rejects missing data container", () => {
    const backup = { format: "yph_full_backup", schemaVersion: 2 };
    const result = validateBackupSchema(backup);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("data"))).toBe(true);
  });

  it("defaults schemaVersion to 1 when not a number", () => {
    const backup = { format: "yph_full_backup", data: {} };
    const result = validateBackupSchema(backup);
    expect(result.schemaVersion).toBe(1);
  });

  it("allows extra fields without failing validation", () => {
    const backup = {
      format: "yph_full_backup",
      schemaVersion: 2,
      data: {},
      extraField: "should be ignored",
      nested: { also: "ignored" },
    };
    const result = validateBackupSchema(backup);
    expect(result.valid).toBe(true);
  });

  it("rejects primitive inputs (string, number, boolean)", () => {
    expect(validateBackupSchema("hello").valid).toBe(false);
    expect(validateBackupSchema(42).valid).toBe(false);
    expect(validateBackupSchema(true).valid).toBe(false);
  });
});
