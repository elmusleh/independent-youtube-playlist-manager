<script lang="ts">
  let { insertPosition, closeTabs, showAdvanced, job } = $props();
</script>

<section class="options-panel">
  <h2>Options</h2>
  <div class="option-row">
    <label>
      <input type="radio" name="position" value="top" bind:group={insertPosition} />
      <span>Add to top (newest first)</span>
    </label>
    <label>
      <input type="radio" name="position" value="bottom" bind:group={insertPosition} />
      <span>Add to bottom (oldest first)</span>
    </label>
  </div>

  <div class="option-row">
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={closeTabs} />
      <span>Close tabs after adding (only tabs successfully added)</span>
    </label>
  </div>

  {#if job.isPageImport}
    <div class="option-row">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={showAdvanced} />
        <span>Show advanced import options</span>
      </label>
    </div>
  {/if}
</section>

<style>
  .options-panel {
    border-top: 1px solid var(--border-color);
    padding-top: 16px;
  }

  .option-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .option-row:last-child {
    margin-bottom: 0;
  }

  .option-row label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-color);
  }

  .option-row input[type="radio"],
  .option-row input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--primary-color);
  }

  .checkbox-label {
    flex-direction: row;
  }
</style>
