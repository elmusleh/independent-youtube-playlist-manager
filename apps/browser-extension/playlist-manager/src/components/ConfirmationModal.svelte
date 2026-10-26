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
  <h3 id="modal-title">{$activeConfirmation.title}</h3>
  <p style="white-space: pre-line">{$activeConfirmation.message}</p>
  <div class="actions">
    <button class="cancel" onclick={executeCancel} data-initial-focus>
      {$activeConfirmation.cancelLabel || "Cancel"}
    </button>
    <button class="confirm {$activeConfirmation.color}" onclick={executeConfirm}>
      {$activeConfirmation.confirmLabel || "Confirm"}
    </button>
  </div>
</Modal>

<style>
  h3 {
    margin-top: 0;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
    margin-top: 2rem;
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
