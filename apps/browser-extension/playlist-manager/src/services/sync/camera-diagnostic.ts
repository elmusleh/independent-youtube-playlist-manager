/**
 * Camera diagnostic helper for QR scanning permissions and recovery.
 */

export interface CameraDiagnostic {
  isPermissionDenied: boolean;
  message: string;
}

export function parseCameraError(err: unknown): CameraDiagnostic {
  if (!err) {
    return {
      isPermissionDenied: false,
      message: "Could not access camera. Try uploading an image instead.",
    };
  }

  const errObj = err as { name?: string; message?: string };
  const name = errObj.name || "";
  const rawMessage = errObj.message || "";

  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    /permission/i.test(rawMessage)
  ) {
    return {
      isPermissionDenied: true,
      message: "Camera permission was denied. Check browser site permissions or upload an image.",
    };
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      isPermissionDenied: false,
      message: "No camera found on this device. Upload a QR image instead.",
    };
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      isPermissionDenied: false,
      message: "Camera is currently in use by another application.",
    };
  }

  return {
    isPermissionDenied: false,
    message: rawMessage || "Could not open camera. Try uploading an image instead.",
  };
}
