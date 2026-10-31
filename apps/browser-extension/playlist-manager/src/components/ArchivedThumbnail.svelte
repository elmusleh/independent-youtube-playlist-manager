<script lang="ts">
  import { archiveThumbnail, readArchivedThumbnail } from "../services/thumbnail-archive";
  let {
    src,
    alt = "Video thumbnail",
    videoId = "",
  }: {
    src?: string | null;
    alt?: string;
    videoId?: string;
  } = $props();
  let resolved = $state<string | undefined>();
  let failed = $state(false);
  $effect(() => {
    const id = videoId || src?.match(/\/vi\/([\w-]{11})\//)?.[1] || "";
    resolved = src || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined);
    failed = false;
    let cancelled = false;
    if (id)
      void (async () => {
        let saved = await readArchivedThumbnail(id);
        if (!saved && (await window.getSettings()).saveThumbnailsLocally)
          saved = await archiveThumbnail(id);
        if (!cancelled && saved) {
          resolved = saved;
          failed = false;
        }
      })().catch(() => {});
    return () => {
      cancelled = true;
    };
  });
</script>

{#if resolved && !failed}
  <img
    src={resolved}
    {alt}
    loading="lazy"
    onerror={() => {
      failed = true;
    }}
  />
{:else}
  <span class="missing" role="img" aria-label={alt}>Preview unavailable</span>
{/if}

<style>
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .missing {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    text-align: center;
  }
</style>
