#!/usr/bin/env node
/**
 * Validate orchestration policy against its JSON schema.
 * Usage: node validate-policy.js [policy-file]
 */

import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function validatePolicy(policyPath, schemaPath) {
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf-8"));
  JSON.parse(fs.readFileSync(schemaPath, "utf-8")); // Schema loaded for future full JSON Schema validation

  // Simple validation - in production, use a proper JSON Schema validator like ajv
  const errors = [];

  // Check required fields
  const requiredFields = [
    "schemaVersion",
    "policyVersion",
    "target",
    "remote",
    "maxActive",
    "mergeMode",
    "allowedAdapters",
    "roles",
    "jobAuthority",
  ];
  for (const field of requiredFields) {
    if (!(field in policy)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate schemaVersion
  if (policy.schemaVersion !== "1.0.0") {
    errors.push(`schemaVersion must be '1.0.0', got '${policy.schemaVersion}'`);
  }

  // Validate target
  if (policy.target !== "next") {
    errors.push(`target must be 'next', got '${policy.target}'`);
  }

  // Validate remote
  if (policy.remote !== "origin") {
    errors.push(`remote must be 'origin', got '${policy.remote}'`);
  }

  // Validate maxActive
  if (typeof policy.maxActive !== "number" || policy.maxActive < 1 || policy.maxActive > 10) {
    errors.push("maxActive must be an integer between 1 and 10");
  }

  // Validate mergeMode
  if (!["manual", "guarded"].includes(policy.mergeMode)) {
    errors.push("mergeMode must be 'manual' or 'guarded'");
  }

  // Validate allowedAdapters
  if (!Array.isArray(policy.allowedAdapters) || policy.allowedAdapters.length === 0) {
    errors.push("allowedAdapters must be a non-empty array");
  } else {
    for (let i = 0; i < policy.allowedAdapters.length; i++) {
      const adapter = policy.allowedAdapters[i];
      if (!adapter.name || !adapter.type || !Array.isArray(adapter.capabilities)) {
        errors.push(`allowedAdapters[${i}] must have name, type, and capabilities array`);
      }
      if (!["hermes", "codex", "manual"].includes(adapter.type)) {
        errors.push(`allowedAdapters[${i}].type must be 'hermes', 'codex', or 'manual'`);
      }
      const validCapabilities = ["dispatch", "status", "cancel", "verify", "review"];
      for (const cap of adapter.capabilities) {
        if (!validCapabilities.includes(cap)) {
          errors.push(`allowedAdapters[${i}].capabilities contains invalid capability: ${cap}`);
        }
      }
    }
  }

  // Validate roles
  const requiredRoles = ["implementer", "reviewer", "verifier"];
  for (const role of requiredRoles) {
    if (!policy.roles?.[role]) {
      errors.push(`roles.${role} is required`);
    } else {
      const r = policy.roles[role];
      if (!r.name || !r.adapter) {
        errors.push(`roles.${role} must have name and adapter`);
      }
    }
  }

  // Validate jobAuthority
  if (!policy.jobAuthority) {
    errors.push("jobAuthority is required");
  } else {
    const ja = policy.jobAuthority;
    if (
      typeof ja.publication?.allowed !== "boolean" ||
      typeof ja.publication?.requiresOwnerOptIn !== "boolean"
    ) {
      errors.push(
        "jobAuthority.publication must have allowed (boolean) and requiresOwnerOptIn (boolean)"
      );
    }
    if (!ja.merge || (ja.merge.mode !== "manual" && ja.merge.mode !== "guarded")) {
      errors.push("jobAuthority.merge.mode must be 'manual' or 'guarded'");
    }
    if (!Array.isArray(ja.merge?.allowedTargets)) {
      errors.push("jobAuthority.merge.allowedTargets must be an array");
    }
    if (
      typeof ja.merge?.requiresOwnerOptIn !== "boolean" ||
      typeof ja.merge?.requiresNonAuthorReview !== "boolean" ||
      typeof ja.merge?.requiresResolvedThreads !== "boolean" ||
      typeof ja.merge?.requiresCurrentChecks !== "boolean" ||
      typeof ja.merge?.requiresEffectiveProtections !== "boolean"
    ) {
      errors.push(
        "jobAuthority.merge requires boolean flags for opt-in, review, threads, checks, protections"
      );
    }
    if (
      typeof ja.cleanup?.preserveDirtyWork !== "boolean" ||
      typeof ja.cleanup?.preserveEvidence !== "boolean" ||
      typeof ja.cleanup?.requiresOwnerAuthority !== "boolean"
    ) {
      errors.push(
        "jobAuthority.cleanup requires boolean flags for preserveDirtyWork, preserveEvidence, requiresOwnerAuthority"
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const policyFile = process.argv[2] || resolve(__dirname, "policy.json");
  const schemaFile = resolve(__dirname, "policy.schema.json");

  console.log(`Validating ${policyFile} against ${schemaFile}...`);

  const result = validatePolicy(policyFile, schemaFile);

  if (result.valid) {
    console.log("✓ Policy is valid");
    process.exit(0);
  } else {
    console.error("✗ Policy validation failed:");
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }
}
