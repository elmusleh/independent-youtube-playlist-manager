<script lang="ts">
  import { onMount } from "svelte";
  import Fa from "svelte-fa";
  import {
    faPuzzlePiece,
    faCode,
    faSync,
    faToggleOn,
    faToggleOff,
  } from "@fortawesome/free-solid-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import SimpleButton from "../components/SimpleButton.svelte";

  let plugins = $state([
    {
      id: "api-setup",
      name: "API Setup",
      description: "Configure YouTube Data API v3 key for enhanced metadata fetching.",
      icon: faCode,
      enabled: false,
      route: "/api-setup",
    },
    {
      id: "cross-device-sync",
      name: "Cross-Device Sync",
      description: "Sync playlists across devices using encrypted zero-knowledge sync.",
      icon: faSync,
      enabled: false,
      route: "/settings",
    },
  ]);

  onMount(() => {
    const stored = localStorage.getItem("yph_plugins");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        plugins = plugins.map((p) => ({
          ...p,
          enabled: parsed[p.id] ?? p.enabled,
        }));
      } catch (e) {
        // ignore
      }
    }
  });

  function togglePlugin(id: string) {
    plugins = plugins.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
    const state: Record<string, boolean> = {};
    plugins.forEach((p) => (state[p.id] = p.enabled));
    localStorage.setItem("yph_plugins", JSON.stringify(state));
  }
</script>

<div class="plugins-view">
  <ViewHeader title="Plugins" icon={faPuzzlePiece} />

  <div class="plugins-grid">
    {#each plugins as plugin (plugin.id)}
      <div class="plugin-card">
        <div class="plugin-header">
          <Fa icon={plugin.icon} />
          <h3>{plugin.name}</h3>
          <button
            class="toggle-btn"
            onclick={() => togglePlugin(plugin.id)}
            aria-label={plugin.enabled ? "Disable" : "Enable"}
          >
            <Fa icon={plugin.enabled ? faToggleOn : faToggleOff} />
          </button>
        </div>
        <p class="plugin-description">{plugin.description}</p>
        <div class="plugin-status">
          {#if plugin.enabled}
            <span class="status-enabled">Enabled</span>
            <a href={plugin.route} class="plugin-link">Configure →</a>
          {:else}
            <span class="status-disabled">Disabled</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .plugins-view {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }
  .plugins-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
    gap: 16px;
  }
  .plugin-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border: 1px solid var(--border-color, #ddd);
    border-radius: 8px;
    background: var(--bg-secondary, #f9f9f9);
  }
  .plugin-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .plugin-header h3 {
    flex: 1;
    margin: 0;
    font-size: 16px;
  }
  .toggle-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 20px;
    color: var(--primary-color, #3b82f6);
  }
  .plugin-description {
    font-size: 14px;
    color: var(--text-secondary, #666);
    margin: 0;
    line-height: 1.4;
  }
  .plugin-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .status-enabled {
    color: var(--success-color, #22c55e);
    font-weight: 600;
  }
  .status-disabled {
    color: var(--text-muted, #999);
  }
  .plugin-link {
    color: var(--primary-color, #3b82f6);
    text-decoration: none;
    font-weight: 500;
  }
  .plugin-link:hover {
    text-decoration: underline;
  }
</style>
