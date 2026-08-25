<script lang="ts">
  import {
    activeConfirmation,
    closeConfirm,
    executeConfirm,
    executeCancel,
  } from "../stores/confirmation";
  import { onDestroy } from "svelte";

  function handleKeydown(event: KeyboardEvent) {
    if ($activeConfirmation.isOpen && event.key === "Escape") {
      executeCancel();
    }
  }

  window.addEventListener("keydown", handleKeydown);
  onDestroy(() => {
    window.removeEventListener("keydown", handleKeydown);
  });
</script>

{#if $activeConfirmation.isOpen}
  <div
    class="modal-overlay"
    onmousedown={(e) => {
      if (e.target === e.currentTarget) executeCancel();
    }}
    onkeydown={handleKeydown}
    role="presentation"
  >
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h3 id="modal-title">{$activeConfirmation.title}</h3>
      <p style="white-space: pre-line">{$activeConfirmation.message}</p>
      <div class="actions">
        <button class="cancel" onclick={executeCancel}>
          {$activeConfirmation.cancelLabel || "Cancel"}
        </button>
        <button class="confirm {$activeConfirmation.color}" onclick={executeConfirm}>
          {$activeConfirmation.confirmLabel || "Confirm"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  }

  .modal-content {
    background: var(--background-color, #fff);
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 400px;
    width: 90%;
    text-align: center;
    border: 1px solid #ddd;
  }

  h3 {
    margin-top: 0;
  }

  .actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 2rem;
  }

  button {
    padding: 0.5rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    border: none;
    font-weight: 600;
  }

  .cancel {
    background: #ccc;
    color: #333;
  }

  .cancel:hover {
    background: #bbb;
  }

  .confirm.default {
    background: #444;
    color: white;
  }

  .confirm.primary {
    background: #007bff;
    color: white;
  }

  .confirm.danger {
    background: #dc3545;
    color: white;
  }

  .confirm:hover {
    opacity: 0.9;
  }
</style>
