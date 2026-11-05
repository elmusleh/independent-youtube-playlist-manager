<script lang="ts">
  import { onDestroy } from "svelte";
  import Fa from "svelte-fa";
  import {
    faQrcode,
    faCamera,
    faUpload,
    faCopy,
    faCheck,
    faXmark,
    faCircleExclamation,
  } from "@fortawesome/free-solid-svg-icons";
  import Modal from "../Modal.svelte";
  import SimpleButton from "../SimpleButton.svelte";
  import { generateSyncKeyQrSvg, detectQrFromImageData } from "../../services/sync/qr-service.js";

  let {
    open = $bindable(false),
    mode = "view",
    syncKey = "",
    onScannedKey,
  }: {
    open?: boolean;
    mode?: "view" | "scan";
    syncKey?: string;
    onScannedKey?: (key: string) => void;
  } = $props();

  let copied = $state(false);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let fileInputEl = $state<HTMLInputElement | null>(null);
  let stream = $state<MediaStream | null>(null);
  let scanError = $state<string | null>(null);
  let isScanning = $state(false);
  let animationFrameId: number | null = null;

  let qrSvg = $derived(syncKey ? generateSyncKeyQrSvg(syncKey) : "");

  $effect(() => {
    if (open && mode === "scan") {
      startCamera();
    } else {
      stopCamera();
    }
  });

  onDestroy(() => {
    stopCamera();
  });

  async function startCamera() {
    scanError = null;
    isScanning = true;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not accessible in this browser");
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.setAttribute("playsinline", "true");
        await videoEl.play();
        scanLoop();
      }
    } catch (err: any) {
      scanError = err?.message || "Could not open camera. Try uploading an image instead.";
      isScanning = false;
    }
  }

  function stopCamera() {
    isScanning = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
  }

  async function scanLoop() {
    if (!isScanning || !videoEl || !canvasEl) return;
    if (videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const width = videoEl.videoWidth;
      const height = videoEl.videoHeight;
      if (width > 0 && height > 0) {
        canvasEl.width = width;
        canvasEl.height = height;
        const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(videoEl, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          const found = await detectQrFromImageData(imageData);
          if (found) {
            handleDetectedKey(found);
            return;
          }
        }
      }
    }
    if (isScanning) {
      animationFrameId = requestAnimationFrame(scanLoop);
    }
  }

  function handleDetectedKey(key: string) {
    stopCamera();
    open = false;
    if (onScannedKey) {
      onScannedKey(key);
    }
  }

  function copySyncKey() {
    if (!syncKey) return;
    navigator.clipboard.writeText(syncKey).then(() => {
      copied = true;
      setTimeout(() => (copied = false), 2000);
    });
  }

  async function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas context");
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      const found = await detectQrFromImageData(imageData);
      if (found) {
        handleDetectedKey(found);
      } else {
        scanError = "No valid QR code found in uploaded image. Please try another image.";
      }
    } catch (err: any) {
      scanError = err?.message || "Failed to process image file";
    } finally {
      input.value = "";
    }
  }
</script>

<Modal
  bind:display={open}
  title={mode === "view" ? "Sync Key QR Code" : "Scan Sync Key"}
  size="standard"
>
  {#snippet children()}
    {#if mode === "view"}
      <div class="qr-view-container">
        <p class="qr-lead">
          Scan this QR code from your phone or tablet to connect this device immediately.
        </p>

        <div class="qr-svg-wrapper">
          {@html qrSvg}
        </div>

        <div class="key-box">
          <code>{syncKey}</code>
          <SimpleButton secondary onclick={copySyncKey}>
            <Fa icon={copied ? faCheck : faCopy} />
            <span>{copied ? "Copied" : "Copy"}</span>
          </SimpleButton>
        </div>
      </div>
    {:else}
      <div class="qr-scan-container">
        <p class="qr-lead">
          Point your camera at the QR code on your desktop, or upload a photo of the code.
        </p>

        {#if scanError}
          <div class="scan-error-banner" role="alert">
            <Fa icon={faCircleExclamation} />
            <span>{scanError}</span>
          </div>
        {/if}

        <div class="camera-preview-wrapper">
          <video bind:this={videoEl} autoplay playsinline muted class="camera-video"></video>
          <canvas bind:this={canvasEl} class="scan-canvas"></canvas>
          <div class="target-crosshair"></div>
        </div>

        <div class="scan-actions">
          <input
            type="file"
            accept="image/*"
            bind:this={fileInputEl}
            onchange={handleFileUpload}
            style="display: none"
          />
          <SimpleButton secondary onclick={() => fileInputEl?.click()}>
            <Fa icon={faUpload} />
            <span>Upload QR image</span>
          </SimpleButton>
          {#if !isScanning}
            <SimpleButton primary onclick={startCamera}>
              <Fa icon={faCamera} />
              <span>Retry Camera</span>
            </SimpleButton>
          {/if}
        </div>
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    <div class="modal-footer-actions">
      <SimpleButton secondary onclick={() => (open = false)}>
        <Fa icon={faXmark} />
        <span>Close</span>
      </SimpleButton>
    </div>
  {/snippet}
</Modal>

<style>
  .qr-view-container,
  .qr-scan-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 8px 0;
  }
  .qr-lead {
    font-size: 0.95rem;
    color: var(--text-color, #333);
    text-align: center;
    margin: 0;
    max-width: 440px;
  }
  .qr-svg-wrapper {
    background: #ffffff;
    padding: 16px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 260px;
    max-height: 260px;
  }
  .qr-svg-wrapper :global(svg) {
    width: 220px;
    height: 220px;
    display: block;
  }
  .key-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--muted, #f3f4f6);
    padding: 6px 12px;
    border-radius: 8px;
    max-width: 100%;
    overflow-x: auto;
  }
  .key-box code {
    font-family: monospace;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .camera-preview-wrapper {
    position: relative;
    width: 100%;
    max-width: 320px;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .camera-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .scan-canvas {
    display: none;
  }
  .target-crosshair {
    position: absolute;
    width: 70%;
    height: 70%;
    border: 2px solid rgba(255, 255, 255, 0.8);
    border-radius: 12px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
    pointer-events: none;
  }
  .scan-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .scan-error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: var(--danger-bg, #fee2e2);
    color: var(--danger-color, #b91c1c);
    border-radius: 8px;
    font-size: 0.88rem;
    max-width: 100%;
  }
  .modal-footer-actions {
    display: flex;
    justify-content: flex-end;
    width: 100%;
  }
</style>
