<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faCamera,
    faUpload,
    faCircleExclamation,
    faShieldHalved,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "../SimpleButton.svelte";

  let {
    isPermissionDenied = false,
    errorMessage = "",
    onRetry,
    onUploadClick,
  }: {
    isPermissionDenied?: boolean;
    errorMessage?: string;
    onRetry?: () => void;
    onUploadClick?: () => void;
  } = $props();
</script>

<div class="camera-diagnostic-card" class:permission-denied={isPermissionDenied} role="alert">
  <div class="card-header">
    <div class="icon-wrapper">
      <Fa icon={isPermissionDenied ? faShieldHalved : faCircleExclamation} />
    </div>
    <div class="header-text">
      <strong
        >{isPermissionDenied ? "Camera permission blocked or denied" : "Camera unavailable"}</strong
      >
      <p class="error-msg">{errorMessage}</p>
    </div>
  </div>

  {#if isPermissionDenied}
    <div class="permission-guide">
      <p class="guide-title">How to allow camera access:</p>
      <ul>
        <li>
          <strong>Firefox Android:</strong> Tap the lock or site settings icon in the address bar
          &rarr; Permissions &rarr; Camera &rarr; select <em>Allowed</em>, then retry.
        </li>
        <li>
          <strong>Chrome / Desktop:</strong> Click the camera icon or site controls in the URL bar
          and switch permission to <em>Allow</em>.
        </li>
        <li>
          <strong>Device settings:</strong> Ensure your OS settings permit your browser app to access
          the camera hardware.
        </li>
      </ul>
    </div>
  {/if}

  <div class="card-actions">
    {#if onUploadClick}
      <SimpleButton secondary onclick={onUploadClick}>
        <Fa icon={faUpload} />
        <span>Choose photo of QR</span>
      </SimpleButton>
    {/if}
    {#if onRetry}
      <SimpleButton primary onclick={onRetry}>
        <Fa icon={faCamera} />
        <span>Try camera again</span>
      </SimpleButton>
    {/if}
  </div>
</div>

<style>
  .camera-diagnostic-card {
    width: 100%;
    max-width: 360px;
    background: var(--danger-bg, #fee2e2);
    border: 1px solid var(--danger-border, #fca5a5);
    border-radius: 10px;
    padding: 12px 14px;
    color: var(--danger-color, #991b1b);
    display: flex;
    flex-direction: column;
    gap: 10px;
    text-align: left;
    font-size: 0.86rem;
  }
  .card-header {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .icon-wrapper {
    font-size: 1.15rem;
    padding-top: 1px;
    flex-shrink: 0;
  }
  .header-text {
    flex: 1;
    min-width: 0;
  }
  .header-text strong {
    display: block;
    font-size: 0.92rem;
    color: var(--danger-color, #991b1b);
    margin-bottom: 2px;
  }
  .error-msg {
    margin: 0;
    font-size: 0.82rem;
    opacity: 0.9;
    word-break: break-word;
  }
  .permission-guide {
    background: rgba(255, 255, 255, 0.65);
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 0.8rem;
    line-height: 1.35;
    color: #450a0a;
  }
  .guide-title {
    margin: 0 0 4px;
    font-weight: 600;
  }
  .permission-guide ul {
    margin: 0;
    padding-left: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .card-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    margin-top: 2px;
  }
</style>
