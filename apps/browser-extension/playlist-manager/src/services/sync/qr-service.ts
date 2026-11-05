/**
 * qr-service.ts
 *
 * Utilities for encoding and decoding Sync Keys as QR codes.
 * - Generating SVG QR code using `uqr`
 * - Scanning QR code from ImageData using `jsQR` (with native BarcodeDetector when available)
 */

import { renderSVG } from "uqr";
import jsQR from "jsqr";

export function generateSyncKeyQrSvg(key: string): string {
  if (!key) return "";
  return renderSVG(key.trim(), {
    ecc: "M",
    border: 2,
  });
}

export async function detectQrFromImageData(imageData: ImageData): Promise<string | null> {
  // If native BarcodeDetector is supported in this browser, try it first
  if (typeof window !== "undefined" && "BarcodeDetector" in window) {
    try {
      // @ts-expect-error - BarcodeDetector is standard web API but not in all TS libs
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const barcodes = await detector.detect(imageData);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return barcodes[0].rawValue.trim();
      }
    } catch {
      // Fallback to jsQR
    }
  }

  // Pure JavaScript fallback
  try {
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });
    if (code && code.data) {
      return code.data.trim();
    }
  } catch {
    // Non-fatal if parsing fails
  }

  return null;
}
