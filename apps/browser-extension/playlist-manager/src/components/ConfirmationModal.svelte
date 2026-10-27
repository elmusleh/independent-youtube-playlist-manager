<script lang="ts">
  import { activeConfirmation, executeConfirm, executeCancel } from "../stores/confirmation";
  import Modal from "./Modal.svelte";
</script>

<Modal
  display={$activeConfirmation.isOpen}
  onclose={executeCancel}
  size="small"
  title={$activeConfirmation.title}
>
  <p style="white-space: pre-line">{$activeConfirmation.message}</p>
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
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
  }

  button {
    min-height: 44px;
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
