<script lang="ts">
  import { activeConfirmation, executeConfirm, executeCancel } from "../stores/confirmation";
  import Modal from "./Modal.svelte";
</script>

<Modal
  display={$activeConfirmation.isOpen}
  onclose={executeCancel}
  size="small"
  title={$activeConfirmation.title}
  footerBorder={false}
>
  <p class="message">{$activeConfirmation.message}</p>
  {#snippet footer()}
    <div class="actions modal-footer">
      <button
        class="cancel"
        onclick={executeCancel}
        data-initial-focus
        aria-label={$activeConfirmation.cancelLabel || "Cancel"}
      >
        {$activeConfirmation.cancelLabel || "Cancel"}
      </button>
      <button
        class="confirm {$activeConfirmation.color}"
        onclick={executeConfirm}
        aria-label={$activeConfirmation.confirmLabel || "Confirm"}
      >
        {$activeConfirmation.confirmLabel || "Confirm"}
      </button>
    </div>
  {/snippet}
</Modal>

<style>
  .message {
    margin: 0;
    white-space: pre-line;
    line-height: 1.6;
    color: var(--text-color);
  }

  .actions.modal-footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  button {
    min-height: 40px;
    padding: 0 20px;
    border-radius: 8px;
    cursor: pointer;
    border: 1px solid transparent;
    font-weight: 600;
    font-size: 14px;
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease,
      opacity 0.15s ease;
  }

  button:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .cancel {
    background: var(--bg-secondary, #eee);
    color: var(--text-color);
    border-color: var(--border-color);
  }

  .cancel:hover {
    background: var(--hover-color);
  }

  .confirm.default {
    background: var(--text-color);
    color: var(--background-color);
  }

  .confirm.primary {
    background: var(--primary-color);
    color: #fff;
  }

  .confirm.danger {
    background: var(--color-brand-danger, #dc3545);
    color: #fff;
  }

  .confirm:hover {
    opacity: 0.9;
  }
</style>
