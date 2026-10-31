import { describe, it, expect } from "vitest";
import { validatePolicy } from "./validate-policy.js";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const schemaFile = resolve(__dirname, "policy.schema.json");
const validPolicyFile = resolve(__dirname, "policy.json");

function readPolicy(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

describe("Orchestration Policy Schema Validation", () => {
  it("validates the default policy as valid", () => {
    const result = validatePolicy(validPolicyFile, schemaFile);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects policy with invalid schemaVersion", () => {
    const policy = readPolicy(validPolicyFile);
    policy.schemaVersion = "2.0.0";
    const tempFile = resolve(__dirname, "temp-invalid-schema.json");
    fs.writeFileSync(tempFile, JSON.stringify(policy, null, 2));

    const result = validatePolicy(tempFile, schemaFile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("schemaVersion"))).toBe(true);

    fs.unlinkSync(tempFile);
  });

  it("rejects policy with invalid target", () => {
    const policy = readPolicy(validPolicyFile);
    policy.target = "main";
    const tempFile = resolve(__dirname, "temp-invalid-target.json");
    fs.writeFileSync(tempFile, JSON.stringify(policy, null, 2));

    const result = validatePolicy(tempFile, schemaFile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("target"))).toBe(true);

    fs.unlinkSync(tempFile);
  });

  it("rejects policy with invalid remote", () => {
    const policy = readPolicy(validPolicyFile);
    policy.remote = "upstream";
    const tempFile = resolve(__dirname, "temp-invalid-remote.json");
    fs.writeFileSync(tempFile, JSON.stringify(policy, null, 2));

    const result = validatePolicy(tempFile, schemaFile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("remote"))).toBe(true);

    fs.unlinkSync(tempFile);
  });

  it("rejects policy with maxActive out of range", () => {
    const policy = readPolicy(validPolicyFile);
    policy.maxActive = 0;
    const tempFile = resolve(__dirname, "temp-invalid-maxactive.json");
    fs.writeFileSync(tempFile, JSON.stringify(policy, null, 2));

    const result = validatePolicy(tempFile, schemaFile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("maxActive"))).toBe(true);

    fs.unlinkSync(tempFile);
  });

  it("rejects policy with invalid mergeMode", () => {
    const policy = readPolicy(validPolicyFile);
    policy.mergeMode = "auto";
    const tempFile = resolve(__dirname, "temp-invalid-mergemode.json");
    fs.writeFileSync(tempFile, JSON.stringify(policy, null, 2));

    const result = validatePolicy(tempFile, schemaFile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("mergeMode"))).toBe(true);

    fs.unlinkSync(tempFile);
  });

  it("rejects policy with empty allowedAdapters", () => {
    const policy = readPolicy(validPolicyFile);
    policy.allowedAdapters = [];
    const tempFile = resolve(__dirname, "temp-empty-adapters.json");
    fs.writeFileSync(tempFile, JSON.stringify(policy, null, 2));

    const result = validatePolicy(tempFile, schemaFile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("allowedAdapters"))).toBe(true);

    fs.unlinkSync(tempFile);
  });

  it("rejects adapter with invalid type", () => {
    const policy = readPolicy(validPolicyFile);
    policy.allowedAdapters[0].type = "invalid";
    const tempFile = resolve(__dirname, "temp-invalid-adapter-type.json");
    fs.writeFileSync(tempFile, JSON.stringify(policy, null, 2));

    const result = validatePolicy(tempFile, schemaFile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("type"))).toBe(true);

    fs.unlinkSync(tempFile);
  });

  it("rejects adapter with invalid capability", () => {
    const policy = readPolicy(validPolicyFile);
    policy.allowedAdapters[0].capabilities = ["invalid"];
    const tempFile = resolve(__dirname, "temp-invalid-capability.json");
    fs.writeFileSync(tempFile, JSON.stringify(policy, null, 2));

    const result = validatePolicy(tempFile, schemaFile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("capability"))).toBe(true);

    fs.unlinkSync(tempFile);
  });

  it("rejects policy with missing role", () => {
    const policy = readPolicy(validPolicyFile);
    delete policy.roles.implementer;
    const tempFile = resolve(__dirname, "temp-missing-role.json");
    fs.writeFileSync(tempFile, JSON.stringify(policy, null, 2));

    const result = validatePolicy(tempFile, schemaFile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("implementer"))).toBe(true);

    fs.unlinkSync(tempFile);
  });

  it("rejects policy with invalid jobAuthority merge mode", () => {
    const policy = readPolicy(validPolicyFile);
    policy.jobAuthority.merge.mode = "auto";
    const tempFile = resolve(__dirname, "temp-invalid-merge-mode.json");
    fs.writeFileSync(tempFile, JSON.stringify(policy, null, 2));

    const result = validatePolicy(tempFile, schemaFile);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("merge"))).toBe(true);

    fs.unlinkSync(tempFile);
  });

  it("rejects policy missing required jobAuthority flags", () => {
    const policy = readPolicy(validPolicyFile);
    delete policy.jobAuthority.merge.requiresOwnerOptIn;
    const tempFile = resolve(__dirname, "temp-missing-flags.json");
    fs.writeFileSync(tempFile, JSON.stringify(policy, null, 2));

    const result = validatePolicy(tempFile, schemaFile);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("requiresOwnerOptIn") || e.includes("boolean flags"))
    ).toBe(true);

    fs.unlinkSync(tempFile);
  });
});
