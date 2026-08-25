<script lang="ts">
  let {
    checked = $bindable(false),
    id = "",
    onchange,
  }: {
    checked?: boolean;
    id?: string;
    onchange?: (checked: boolean) => void;
  } = $props();

  function toggle() {
    checked = !checked;
    if (onchange) onchange(checked);
  }
</script>

<div
  class="toggle-container"
  onclick={toggle}
  role="switch"
  aria-checked={checked}
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === "Enter" || e.key === " ") toggle();
  }}
>
  <input aria-label="Toggle switch" type="checkbox" {id} bind:checked style="display: none;" />
  <div class="toggle-track" class:checked>
    <div class="toggle-thumb" class:checked></div>
  </div>
</div>

<style>
  .toggle-container {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    user-select: none;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }

  .toggle-container:focus-visible .toggle-track {
    box-shadow:
      0 0 0 2px var(--background-color),
      0 0 0 4px var(--primary-color);
  }

  .toggle-track {
    position: relative;
    width: 36px;
    height: 20px;
    background-color: var(--border-color);
    border-radius: 20px;
    transition: background-color 0.2s ease;
  }

  .toggle-track.checked {
    background-color: var(--primary-color);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background-color: #fff;
    border-radius: 50%;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .toggle-thumb.checked {
    transform: translateX(16px);
  }
</style>
