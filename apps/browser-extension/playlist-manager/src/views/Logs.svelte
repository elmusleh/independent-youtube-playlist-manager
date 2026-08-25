<script lang="ts">
  import Fa from "svelte-fa";
  import { faBug, faTrash, faTerminal, faCopy } from "@fortawesome/free-solid-svg-icons";
  import ViewHeader from "../components/ViewHeader.svelte";
  import StickyHeader from "../components/StickyHeader.svelte";
  import SimpleButton from "../components/SimpleButton.svelte";
  import SaveStatus from "../components/SaveStatus.svelte";
  import { StatusManager } from "../services/status-manager.svelte";
  import { tick } from "svelte";
  import { requestConfirm } from "../stores/confirmation";

  const browser = (window as any).browser || (window as any).chrome;

  let logs: string[] = $state([]);
  const status = new StatusManager();
  let logEl: HTMLPreElement = $state(undefined as any);

  async function loadLogs() {
    await status.refresh(async () => {
      try {
        const result = await browser.storage.local.get("yph_system_logs");
        logs = result.yph_system_logs || [];
        if (window.logSystemEvent) {
          await window.logSystemEvent("INFO", `[LOGS-VIEW] Loaded ${logs.length} log entries`);
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error("Failed to load logs:", e);
        logs = ["Failed to load logs: " + errMsg];
        throw e; // StatusManager will catch this
      }

      // Ensure we scroll to the bottom after Svelte renders the logs
      setTimeout(async () => {
        await tick();
        if (logEl) {
          logEl.scrollTop = logEl.scrollHeight;
        }
      }, 50);
    });
  }

  async function copyLogs() {
    try {
      await navigator.clipboard.writeText(logs.join("\n"));
      window.success("Logs copied to clipboard");
      if (window.logSystemEvent) {
        await window.logSystemEvent("INFO", "[LOGS-VIEW] Logs copied to clipboard");
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      window.error("Failed to copy logs");
      if (window.logSystemEvent) {
        await window.logSystemEvent("ERROR", `[LOGS-VIEW] Failed to copy logs: ${errMsg}`);
      }
    }
  }

  function requestClearLogs() {
    requestConfirm({
      title: "Clear system logs?",
      message: "This will permanently delete all stored system logs.",
      color: "danger",
      onConfirm: async () => {
        try {
          await browser.storage.local.remove("yph_system_logs");
          logs = [];
          window.success("Logs cleared");
          if (window.logSystemEvent) {
            await window.logSystemEvent("INFO", "[LOGS-VIEW] System logs cleared by user");
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          window.error("Failed to clear logs");
          if (window.logSystemEvent) {
            await window.logSystemEvent("ERROR", `[LOGS-VIEW] Failed to clear logs: ${errMsg}`);
          }
        }
      },
    });
  }

  loadLogs();
</script>

<main class="view-scroll-container">
  <div class="view-body">
    <StickyHeader>
      {#snippet children()}
        <ViewHeader icon={faTerminal} title="System Logs" count={logs.length}>
          {#snippet rightActions()}
            {#if logs.length > 0}
              <SimpleButton onclick={copyLogs} secondary>
                <Fa icon={faCopy} fw />
                <span>Copy</span>
              </SimpleButton>

              <SimpleButton onclick={requestClearLogs} danger>
                <Fa icon={faTrash} fw />
                <span>Clear Logs</span>
              </SimpleButton>
            {/if}

            <SaveStatus onclick={loadLogs} {status} />
          {/snippet}
        </ViewHeader>
      {/snippet}
    </StickyHeader>

    <div class="logs-container">
      {#if status.refreshing}
        <p class="status">Loading logs...</p>
      {:else if logs.length === 0}
        <div class="empty-state">
          <Fa icon={faBug} size="3x" />
          <p>No system logs found.</p>
          <p class="sub-text">Logs will appear here when extension events occur.</p>
        </div>
      {:else}
        <pre class="log-output" bind:this={logEl}>{logs.join("\n")}</pre>
      {/if}
    </div>
  </div>
</main>

<style>
  @import "../css/view-layout.css";

  main {
    display: flex;
    flex-direction: column;
    width: 100%;
    margin: 0 auto;
    max-width: 1400px;
  }

  .logs-container {
    height: calc(100vh - 180px);
    width: 100%;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  }

  .status {
    padding: 40px;
    color: #8b949e;
    text-align: center;
    font-size: 16px;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    color: #8b949e;
    gap: 15px;
  }

  .empty-state .sub-text {
    font-size: 13px;
    opacity: 0.7;
  }

  .log-output {
    margin: 0;
    padding: 20px;
    font-size: 13px;
    line-height: 1.6;
    color: #c9d1d9;
    font-family:
      ui-monospace,
      SFMono-Regular,
      SF Mono,
      Menlo,
      Consolas,
      Liberation Mono,
      monospace;
    white-space: pre-wrap;
    word-break: break-all;
    overflow-y: scroll;
    flex: 1;
  }

  /* Custom Scrollbar for Logs */
  .log-output {
    scrollbar-width: thin;
    scrollbar-color: #30363d #0d1117;
  }
</style>
