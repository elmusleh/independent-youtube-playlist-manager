<script lang="ts">
  import Fa from "svelte-fa";
  import { faSearch, faXmark } from "@fortawesome/free-solid-svg-icons";

  let {
    value = $bindable(""),
    placeholder = "Search...",
    className = "",
    oninput = undefined
  }: {
    value: string;
    placeholder?: string;
    className?: string;
    oninput?: (e: Event) => void;
  } = $props();

  function clear() {
    value = "";
    if (oninput) {
      // Dispatch a dummy event to trigger potential handlers
      oninput(new Event('input'));
    }
  }
</script>

<div class="search-input-container {className}">
  <div class="search-icon">
    <Fa icon={faSearch} fw />
  </div>
  <input
    type="text"
    {placeholder}
    bind:value
    {oninput}
    aria-label="Search"
  />
  {#if value}
    <button class="clear-btn" onclick={clear} aria-label="Clear search">
      <Fa icon={faXmark} fw />
    </button>
  {/if}
</div>

<style>
  .search-input-container {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    max-width: 400px;
    height: 40px;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    color: var(--text-muted);
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  input {
    width: 100%;
    height: 100%;
    padding: 0 40px;
    border: 1px solid var(--border-color);
    border-radius: 20px;
    background: var(--hover-color);
    color: var(--text-color);
    font-size: 14px;
    transition: all 0.2s;
    margin: 0 !important;
  }

  input:focus {
    outline: none;
    border-color: var(--primary-color);
    background: var(--background-color);
    box-shadow: 0 0 0 3px rgba(62, 166, 255, 0.1);
  }

  input::placeholder {
    color: var(--text-muted);
    opacity: 0.7;
  }

  .clear-btn {
    position: absolute;
    right: 8px;
    background: none;
    border: none;
    color: var(--text-muted);
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .clear-btn:hover {
    background: var(--border-color);
    color: var(--text-color);
  }

  @media (max-width: 768px) {
    .search-input-container {
      max-width: 100%;
    }
  }
</style>
