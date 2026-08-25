<script lang="ts">
  import { onDestroy } from "svelte";
  import Fa from "svelte-fa";
  import {
    faArrowUp,
    faArrowDown,
    faChevronUp,
    faChevronDown,
    faXmark,
    faPlus,
  } from "@fortawesome/free-solid-svg-icons";
  import type { SortDirection, SortField, SortRule } from "../../types/model";
  import {
    SORT_FIELD_LABELS,
    describeSortRule,
    describeSortRules,
  } from "../../utils/playlist-utils";
  import SimpleButton from "../SimpleButton.svelte";

  let {
    display = $bindable(false),
    initialRules = [] as SortRule[],
    onApply,
    maxRules = 3,
  }: {
    display?: boolean;
    initialRules?: SortRule[];
    onApply?: (rules: SortRule[]) => void;
    maxRules?: number;
  } = $props();

  const fieldOptions = Object.keys(SORT_FIELD_LABELS) as SortField[];

  let rules = $state<SortRule[]>([]);
  let error = $state("");

  // Re-initialize the editable rule list every time the modal opens.
  $effect(() => {
    if (display) {
      rules =
        initialRules && initialRules.length > 0
          ? initialRules.map((r) => ({ ...r }))
          : [{ field: "title", direction: "asc" }];
      error = "";
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    if (display && event.key === "Escape") {
      display = false;
    }
  }
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleKeydown);
  }
  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", handleKeydown);
    }
  });

  const canAdd = $derived(rules.length < maxRules);

  function addRule() {
    if (!canAdd) return;
    rules = [...rules, { field: "title", direction: "asc" }];
  }

  function removeRule(index: number) {
    if (rules.length <= 1) return;
    rules = rules.filter((_, i) => i !== index);
  }

  function moveRule(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= rules.length) return;
    const next = [...rules];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    rules = next;
  }

  function setField(index: number, field: SortField) {
    rules = rules.map((r, i) => (i === index ? { ...r, field } : r));
  }

  function toggleDirection(index: number) {
    rules = rules.map((r, i) =>
      i === index
        ? { ...r, direction: (r.direction === "asc" ? "desc" : "asc") as SortDirection }
        : r
    );
  }

  function apply() {
    const cleanRules = rules.filter(
      (r) => r && typeof r.field === "string" && (r.direction === "asc" || r.direction === "desc")
    );
    if (cleanRules.length === 0) {
      error = "Add at least one sort rule.";
      return;
    }
    onApply?.(cleanRules);
    display = false;
  }
</script>

{#if display}
  <div
    class="multisort-overlay"
    role="presentation"
    onmousedown={(e) => {
      if (e.target === e.currentTarget) display = false;
    }}
  >
    <div class="multisort-dialog" role="dialog" aria-modal="true" aria-label="Custom Multi-Sort">
      <div class="multisort-header">
        <h2>Custom Multi-Sort</h2>
        <button
          class="close-btn"
          onclick={() => (display = false)}
          title="Close"
          aria-label="Close"
        >
          <Fa icon={faXmark} fw />
        </button>
      </div>

      <p class="multisort-hint">
        Videos are sorted by the first rule first, then each subsequent rule breaks ties.
      </p>

      {#if rules.length > 0}
        <div class="rule-list">
          {#each rules as rule, index (index)}
            <div class="rule-row">
              <span class="rule-order">
                {index === 0 ? "Sort by" : index === 1 ? "Then by" : "Then by"}
              </span>
              <select
                class="rule-field"
                value={rule.field}
                onchange={(e) =>
                  setField(index, (e.currentTarget as HTMLSelectElement).value as SortField)}
                aria-label="Sort field"
              >
                {#each fieldOptions as field}
                  <option value={field}>{SORT_FIELD_LABELS[field]}</option>
                {/each}
              </select>
              <button
                class="direction-toggle"
                class:desc={rule.direction === "desc"}
                onclick={() => toggleDirection(index)}
                title={describeSortRule(rule)}
                aria-label="Toggle sort direction"
              >
                <Fa icon={rule.direction === "asc" ? faArrowUp : faArrowDown} fw />
                <span>{rule.direction === "asc" ? "Asc" : "Desc"}</span>
              </button>
              <div class="rule-actions">
                <button
                  class="icon-btn"
                  onclick={() => moveRule(index, -1)}
                  disabled={index === 0}
                  title="Move up"
                  aria-label="Move sort rule up"
                >
                  <Fa icon={faChevronUp} fw />
                </button>
                <button
                  class="icon-btn"
                  onclick={() => moveRule(index, 1)}
                  disabled={index === rules.length - 1}
                  title="Move down"
                  aria-label="Move sort rule down"
                >
                  <Fa icon={faChevronDown} fw />
                </button>
                <button
                  class="icon-btn icon-btn--danger"
                  onclick={() => removeRule(index)}
                  disabled={rules.length <= 1}
                  title="Remove rule"
                  aria-label="Remove sort rule"
                >
                  <Fa icon={faXmark} fw />
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if canAdd}
        <button class="add-rule-btn" onclick={addRule}>
          <Fa icon={faPlus} fw />
          <span>Add Sort Level</span>
        </button>
      {:else}
        <p class="max-rules-hint">Maximum of {maxRules} sort levels.</p>
      {/if}

      {#if error}
        <p class="multisort-error">{error}</p>
      {/if}

      {#if rules.length > 0}
        <p class="multisort-preview">Preview: {describeSortRules(rules) || "—"}</p>
      {/if}

      <div class="multisort-footer">
        <SimpleButton onclick={() => (display = false)} secondary>
          <span>Cancel</span>
        </SimpleButton>
        <SimpleButton onclick={apply} primary>
          <span>Apply & Save</span>
        </SimpleButton>
      </div>
    </div>
  </div>
{/if}

<style>
  .multisort-overlay {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 3000;
    padding: 20px;
  }

  .multisort-dialog {
    background: var(--background-color);
    padding: 24px;
    border-radius: 16px;
    max-width: 560px;
    width: 100%;
    border: 1px solid var(--border-color);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    animation: multisort-appear 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    max-height: 85vh;
    overflow-y: auto;
  }

  @keyframes multisort-appear {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .multisort-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .multisort-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--text-color);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .close-btn:hover {
    background: var(--hover-color);
    color: var(--text-color);
  }

  .multisort-hint {
    margin: 0 0 16px;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .rule-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .rule-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    background: var(--active-bg-color);
    flex-wrap: wrap;
  }

  .rule-order {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    min-width: 58px;
    flex-shrink: 0;
  }

  .rule-field {
    flex: 1;
    min-width: 140px;
    height: 34px;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--background-color);
    color: var(--text-color);
    font-size: 13px;
    font-family: inherit;
    outline: none;
  }

  .rule-field:focus-visible {
    border-color: var(--primary-color);
  }

  .direction-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--background-color);
    color: var(--text-color);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.2s,
      border-color 0.2s;
  }

  .direction-toggle:hover {
    background: var(--hover-color);
  }

  .direction-toggle.desc {
    color: var(--primary-color);
    border-color: color-mix(in srgb, var(--primary-color) 40%, var(--border-color));
  }

  .rule-actions {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }

  .icon-btn {
    width: 30px;
    height: 30px;
    border-radius: 6px;
    border: none;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background 0.2s,
      color 0.2s;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--hover-color);
    color: var(--text-color);
  }

  .icon-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .icon-btn--danger:hover:not(:disabled) {
    color: #f44336;
    background: rgba(244, 67, 54, 0.1);
  }

  .add-rule-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    justify-content: center;
    padding: 10px;
    border: 1px dashed var(--border-color);
    border-radius: 10px;
    background: none;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.2s,
      color 0.2s,
      border-color 0.2s;
  }

  .add-rule-btn:hover {
    background: var(--hover-color);
    color: var(--primary-color);
    border-color: var(--primary-color);
  }

  .max-rules-hint {
    margin: 8px 0;
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
  }

  .multisort-error {
    margin: 12px 0 0;
    font-size: 13px;
    color: #f44336;
  }

  .multisort-preview {
    margin: 12px 0 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  .multisort-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }
</style>
