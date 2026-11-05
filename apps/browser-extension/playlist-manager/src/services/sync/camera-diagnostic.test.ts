import { describe, it, expect } from "vitest";
import { parseCameraError } from "./camera-diagnostic.js";

describe("parseCameraError", () => {
  it("identifies NotAllowedError as permission denied", () => {
    const error = new DOMException(
      "The request is not allowed by the user agent",
      "NotAllowedError"
    );
    const diag = parseCameraError(error);
    expect(diag.isPermissionDenied).toBe(true);
    expect(diag.message).toContain("permission was denied");
  });

  it("identifies PermissionDeniedError as permission denied", () => {
    const error = { name: "PermissionDeniedError", message: "User denied permission" };
    const diag = parseCameraError(error);
    expect(diag.isPermissionDenied).toBe(true);
  });

  it("identifies permission keyword in raw error message", () => {
    const error = new Error("Camera permission dismissed by user");
    const diag = parseCameraError(error);
    expect(diag.isPermissionDenied).toBe(true);
  });

  it("identifies NotFoundError as hardware not found", () => {
    const error = new DOMException("Requested device not found", "NotFoundError");
    const diag = parseCameraError(error);
    expect(diag.isPermissionDenied).toBe(false);
    expect(diag.message).toContain("No camera found");
  });

  it("handles null/unknown errors gracefully", () => {
    const diag = parseCameraError(null);
    expect(diag.isPermissionDenied).toBe(false);
    expect(diag.message).toContain("Could not access camera");
  });
});
