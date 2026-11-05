<script lang="ts">
  import { onMount } from "svelte";
  import { enrichVideoMetadata } from "../services/enrichment-service";
  import Modal from "../components/Modal.svelte";
  import { requestDataConsent, ACCOUNT_DATA } from "../utils/data-consent";
  const api = window.browser || window.chrome;
  const jobId = new URLSearchParams(location.hash.split("?")[1]).get("job");
  let job = $state<any>(null);
  let destinations = $state<any[]>([]);
  let builderAllowed = $state(true);
  let savedAllowed = $state(true);
  let query = $state("");
  let destination = $state("new");
  let quantity = $state(0);
  let order = $state("newest");
  let title = $state("New local playlist");
  let busy = $state(false);
  let metadataBusy = $state(false);
  let metadataCancelled = false;
  let metadataProgress = $state(0);
  let error = $state("");
  let visible = $state(true);
  let result = $state<any>(null);
  const remote = $derived(
    !["new", "builder"].includes(destination) && !destination.startsWith("local-")
  );
  const matches = $derived(
    destinations.filter((p) => p.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  );
  const selected = $derived(destinations.find((p) => p.id === destination));
  async function command(action: string, extra: Record<string, unknown> = {}) {
    const response = await api.runtime.sendMessage({ cmd: "capture", action, id: jobId, ...extra });
    if (!response?.ok)
      throw new Error(
        response?.error || "The background could not be reached. Retry this capture."
      );
    return response.result;
  }
  async function load(initial = false) {
    try {
      const data = await command("get");
      job = data.job;
      builderAllowed = data.constraints?.builderAllowed ?? true;
      savedAllowed = data.constraints?.savedAllowed ?? true;
      destinations = savedAllowed ? data.destinations : [];
      if (initial) {
        title = job.title || "New local playlist";
        destination =
          job.destinationId ||
          job.requestedId ||
          (job.mode === "builder"
            ? "builder"
            : job.mode === "new"
              ? "new"
              : destinations.some((p) => p.id === job.mode)
                ? job.mode
                : "");
        if (!destination && job.operation !== "destination")
          error =
            "The requested destination is unavailable. Choose a playlist; nothing has been saved.";
      }
      if (job.status === "complete") result = job.result;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }
  async function submit() {
    if (!destination || busy) return;
    busy = true;
    error = "";
    try {
      if (remote && job.operation !== "destination") await requestDataConsent(ACCOUNT_DATA);
      const options: Record<string, unknown> = { title };
      if (job.operation === "import" && !job.destinationId)
        Object.assign(options, { quantity, order });
      result = await command(job.operation === "destination" ? "destination" : "commit", {
        destinationId: destination,
        remoteConsent: remote,
        options,
      });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      busy = false;
      await load();
    }
  }
  async function cancel() {
    try {
      await command("cancel");
      visible = false;
      location.hash = "#/saved";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }
  async function refreshRemote() {
    busy = true;
    error = "";
    try {
      await requestDataConsent(ACCOUNT_DATA);
      destinations = await command("destinations");
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      busy = false;
    }
  }
  async function scan() {
    busy = true;
    error = "";
    try {
      await command("scan", { quantity });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      busy = false;
      await load();
    }
  }
  async function fetchMetadata() {
    metadataBusy = true;
    metadataCancelled = false;
    error = "";
    try {
      // Small batches cap concurrent provider work; cancellation never undoes saved IDs.
      for (let index = 0; index < job.ids.length && !metadataCancelled; index += 4) {
        await enrichVideoMetadata(job.ids.slice(index, index + 4));
        metadataProgress = Math.min(index + 4, job.ids.length);
      }
    } catch {
      error =
        "Videos are saved. Some metadata could not be fetched; retry later or use Metadata Manager.";
    } finally {
      metadataBusy = false;
    }
  }
  onMount(() => {
    load(true);
    const timer = setInterval(() => {
      if (busy) load();
    }, 1000);
    return () => {
      metadataCancelled = true;
      clearInterval(timer);
    };
  });
</script>

<main class="view-scroll-container">
  <Modal
    bind:display={visible}
    title={job?.operation === "destination" ? "Choose destination" : "Review captured videos"}
    onclose={cancel}
  >
    {#if error}<p role="alert">{error}</p>{/if}
    {#if result}
      <p role="status">
        {job?.operation === "destination"
          ? "Destination selected. Your next menu action will use it."
          : `Saved ${result.added || 0} video(s); ${result.duplicates || 0} already present.`}
      </p>
      {#if job?.operation !== "destination"}
        <p>
          Video IDs are saved even when metadata providers are unavailable. Fetch titles and
          durations to fill thumbnail badges.
        </p>
        <button type="button" onclick={fetchMetadata} disabled={metadataBusy}
          >Fetch missing titles and durations</button
        >
        {#if metadataBusy}<button type="button" onclick={() => (metadataCancelled = true)}
            >Stop fetching</button
          >{/if}
        {#if metadataProgress}<p role="status">
            Metadata processed: {metadataProgress} / {job.ids.length}
          </p>{/if}
      {/if}
      <a
        href={result.id === "builder"
          ? "#/playlist-builder"
          : result.id
            ? `#/playlist?id=${encodeURIComponent(result.id)}`
            : "#/saved"}>Open playlist</a
      >
    {:else if job}
      <p>
        {job.ids.length.toLocaleString()} unique video(s). Tabs stay open unless you enabled closing in
        the relevant settings.
      </p>
      <label for="capture-search">Find a saved playlist</label>
      <input
        id="capture-search"
        type="search"
        bind:value={query}
        disabled={busy || !!job.destinationId}
        data-initial-focus
      />
      <label for="capture-destination">Destination</label>
      <select
        id="capture-destination"
        bind:value={destination}
        disabled={busy || !!job.destinationId}
      >
        <option value="">Choose a playlist</option>
        {#if savedAllowed}<option value="new">New local playlist</option>{/if}
        {#if builderAllowed}<option value="builder">Playlist Builder</option>{/if}
        {#if selected && !matches.slice(0, 100).some((p) => p.id === selected.id)}<option
            value={selected.id}
            >{selected.title} ({selected.id.startsWith("local-") ? "Local" : "YouTube"})</option
          >{/if}
        {#each matches.slice(0, 100) as playlist (playlist.id)}
          <option value={playlist.id}
            >{playlist.title} ({playlist.id.startsWith("local-") ? "Local" : "YouTube"})</option
          >
        {/each}
      </select>
      {#if matches.length > 100}<p>Showing the first 100 matches. Refine your search.</p>{/if}
      <button type="button" onclick={refreshRemote} disabled={busy}>Load YouTube playlists</button>
      {#if selected}<p class="destination-title">Selected: {selected.title}</p>{/if}
      {#if destination === "new"}<label for="capture-title">Playlist name</label><input
          id="capture-title"
          bind:value={title}
          maxlength="500"
          disabled={busy}
        />{/if}
      {#if job.operation === "import" && !job.destinationId}
        <button type="button" onclick={scan} disabled={busy}
          >{job.canScroll ? "Scan channel (load more videos)" : "Scan page again"}</button
        >
        <label for="capture-quantity">Number of videos (0 = all)</label>
        <input
          id="capture-quantity"
          type="number"
          min="0"
          max="1000"
          step="1"
          bind:value={quantity}
          disabled={busy}
        />
        <label for="capture-order">Order</label>
        <select id="capture-order" bind:value={order} disabled={busy}
          ><option value="newest">Page order</option><option value="oldest"
            >Reverse page order</option
          ></select
        >
      {/if}
      {#if remote && job.operation !== "destination"}
        <p>
          Sync adds these videos to the selected YouTube playlist. You must sign in and allow
          account data access. Cancel sends no new requests. If Sync is interrupted, saved progress
          is reconciled before retrying.
        </p>
        <a href="#/settings" target="_blank" rel="noopener">Open sign-in settings</a>
      {/if}
      {#if busy}<p role="status" aria-live="polite">
          {job.status === "scanning"
            ? "Scanning source page…"
            : `Saving… ${job.addedIds?.length || 0} confirmed video(s).`} You can cancel remaining work.
        </p>{/if}
    {:else}<p role="status">Loading capture…</p>{/if}
    {#snippet footer()}
      <div class="modal-footer capture-footer">
        <button type="button" onclick={cancel}>Cancel</button>
        {#if !result}<button type="button" onclick={submit} disabled={busy || !job || !destination}
            >{job?.operation === "destination"
              ? "Use destination"
              : remote
                ? "Sync"
                : error
                  ? "Retry save"
                  : "Save locally"}</button
          >{/if}
      </div>
    {/snippet}
  </Modal>
</main>

<style>
  .capture-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  label {
    display: block;
    margin-top: 1rem;
  }
  input,
  select {
    display: block;
    width: 100%;
    min-width: 0;
    min-height: 44px;
    margin-block: 0.4rem;
  }
  button {
    min-height: 44px;
    white-space: normal;
  }
  p,
  .destination-title {
    overflow-wrap: anywhere;
  }
  [role="alert"] {
    color: var(--danger-color, #b42318);
  }
</style>
