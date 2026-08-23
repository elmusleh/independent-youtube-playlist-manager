<script lang="ts">
    import Fa from "svelte-fa";
    import {
        faArrowUpRightFromSquare,
        faListUl,
        faWrench,
        faChevronDown,
        faCloud,
        faSearch,
        faFile,
    } from "@fortawesome/free-solid-svg-icons";
    import PlaylistSelector from "../components/PlaylistSelector.svelte";
    import AuthPlaceholder from "../components/AuthPlaceholder.svelte";
    import SkeletonCard from "../components/SkeletonCard.svelte";
    import Card from "../components/Card.svelte";
    import CardGrid from "../components/CardGrid.svelte";
    import { requestConfirm } from "../stores/confirmation";
    import { playlistsSearch } from "../stores/playlists-filters";
    import { onDestroy } from "svelte";
    import type { Playlist, Settings } from "../types/model";

    const browser = (window as any).browser || (window as any).chrome;

    let signedIn = false;
    let loading = true;
    let accountPlaylists: YtPlaylistInfoExtended[] = [];
    let localPlaylists: Playlist[] = [];
    let adoptingId = "";
    let syncingId = "";
    let settings: Settings | null = null;

    // ✅ Initialize at module level, not in onMount
    window.getSettings().then((s) => (settings = s));

    const filterChips = ["All", "Managed", "Unmanaged"];
    let activeChip = "All";

    const sortOptions = ["Recently added", "A-Z"];
    let activeSort = "Recently added";
    let sortOpen = false;

    function closeSortDropdown() {
        sortOpen = false;
    }

    $: allPlaylists = (() => {
        if (signedIn && accountPlaylists.length > 0) {
            return accountPlaylists;
        }
        return localPlaylists.map((p) => ({
            id: p.id,
            title: p.title,
            timestamp: p.timestamp,
            videoCount: p.videos.length,
            isTagged: false,
            isLocal: true,
            thumbnailUrl: window.videoService.getVideoThumbnailUrl(p.videos[0]),
        }));
    })();

    $: displayedPlaylists = (() => {
        let result = allPlaylists.filter((p) => {
            if (
                $playlistsSearch &&
                !p.title.toLowerCase().includes($playlistsSearch.toLowerCase())
            ) {
                return false;
            }
            if (activeChip === "Managed") return p.isTagged;
            if (activeChip === "Unmanaged") return !p.isTagged;
            return true;
        });

        if (activeSort === "A-Z") {
            result = [...result].sort((a, b) => a.title.localeCompare(b.title));
        } else {
            result = [...result].sort((a, b) => b.timestamp - a.timestamp);
        }
        return result;
    })();

    async function checkAuth() {
        try {
            const status = await window.isSignedIn();
            if (status !== signedIn) {
                signedIn = status;
                if (signedIn) {
                    ytPlaylistsLoader();
                }
            }
        } catch (e) {
            console.error("Auth check failed", e);
        }
    }

    async function loadLocal() {
        try {
            localPlaylists = await window.getPlaylists();
        } catch (e) {
            console.error("Failed to load local playlists", e);
        }
    }

    async function init() {
        await loadLocal();
        await checkAuth();
        if (signedIn) {
            await ytPlaylistsLoader();
        } else {
            loading = false;
        }
    }

    // ✅ Initialize at module level
    init();

    let _debounce: ReturnType<typeof setTimeout> | null = null;

    function handleStorageChange(
        changes: Record<string, { oldValue?: any; newValue?: any }>,
        area: string,
    ) {
        if (area !== "local") return;

        if ("yt_auth_token_cache" in changes) {
            const wasSignedIn = signedIn;
            signedIn = changes["yt_auth_token_cache"].newValue != null;
            if (signedIn && !wasSignedIn) ytPlaylistsLoader();
            else if (!signedIn && wasSignedIn) {
                accountPlaylists = [];
                loadLocal();
            }
            return;
        }

        if ("watchLaterPlaylistId" in changes) {
            window.getSettings().then((s) => (settings = s));
        }

        if ("yt_playlist_cache_v1" in changes) {
            if (changes["yt_playlist_cache_v1"].newValue !== undefined) return;
            if (_debounce) clearTimeout(_debounce);
            _debounce = setTimeout(() => {
                _debounce = null;
                if (signedIn) ytPlaylistsLoader();
                else loadLocal();
            }, 300);
        }
    }

    browser.storage.onChanged.addListener(handleStorageChange);
    onDestroy(() => {
        browser.storage.onChanged.removeListener(handleStorageChange);
        if (_debounce) clearTimeout(_debounce);
    });

    function requestAdopt(p: YtPlaylistInfoExtended) {
        requestConfirm({
            title: "Adopt Playlist?",
            message:
                "This will add this YouTube playlist to your local management.",
            color: "primary",
            onConfirm: () => adopt(p),
        });
    }

    async function adopt(p: YtPlaylistInfoExtended) {
        adoptingId = p.id;
        try {
            await window.adoptPlaylist(p.id);
        } catch (e) {
            console.error("Failed to adopt playlist", e);
            window.error("Failed to adopt playlist");
        } finally {
            adoptingId = "";
        }
    }

    function requestSync(p: YtPlaylistInfoExtended) {
        requestConfirm({
            title: "Sync to YouTube?",
            message:
                "This will create a new playlist on your YouTube account and link this offline playlist to it.",
            color: "primary",
            onConfirm: () => syncPlaylist(p),
        });
    }

    async function syncPlaylist(p: YtPlaylistInfoExtended) {
        const localP = localPlaylists.find((lp) => lp.id === p.id);
        if (!localP) return;

        syncingId = p.id;
        try {
            await window.savePlaylist(localP, { syncToYoutube: true });
            window.success("Playlist synced to YouTube");
        } catch (e) {
            console.error("Failed to sync playlist:", e);
            window.error("Failed to sync playlist");
        } finally {
            syncingId = "";
        }
    }

    async function ytPlaylistsLoader() {
        const dismiss = window.info("Refreshing playlists...");
        loading = true;
        try {
            accountPlaylists = await window.getAccountPlaylists();
        } catch (e) {
            console.error("Failed to load playlists:", e);
            if (signedIn) {
                window.error("Failed to sync with YouTube");
            }
        } finally {
            loading = false;
            if (dismiss) dismiss();
        }
    }

    function openInEditor(p: YtPlaylistInfoExtended | Playlist) {
        const base = location.href.split("#")[0].split("?")[0];
        location.href = `${base}?id=${encodeURIComponent(p.id)}#/editor`;
    }

    async function triggerSignIn() {
        try {
            await window.signIn();
        } catch (e) {
            console.error("Sign in failed", e);
        }
    }
</script>

<svelte:window on:click={closeSortDropdown} />

<main class="flex flex-col gap-lg p-6">
    <header class="space-y-2">
        <h1 class="text-4xl font-extrabold text-primary">Playlists</h1>
        <p class="text-secondary">Manage and organize your YouTube playlists</p>
    </header>

    <!-- Sticky Filter & Sort Bar -->
    <div class="sticky-header gap-sm flex-wrap py-4 -mx-6 px-6">
        <!-- Sort Dropdown -->
        <div class="sort-wrapper">
            <button
                class="chip"
                class:sort-open={sortOpen}
                aria-expanded={sortOpen}
                aria-haspopup="listbox"
                on:click|stopPropagation={() => (sortOpen = !sortOpen)}
            >
                <span>{activeSort}</span>
                <Fa icon={faChevronDown} fw />
            </button>
            {#if sortOpen}
                <div class="sort-dropdown" role="listbox">
                    {#each sortOptions as option}
                        <button
                            class:selected={activeSort === option}
                            class="sort-option"
                            role="option"
                            aria-selected={activeSort === option}
                            on:click|stopPropagation={() => {
                                activeSort = option;
                                sortOpen = false;
                            }}
                        >
                            {option}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- Filter Chips -->
        {#each filterChips as chip}
            <button
                class:active={activeChip === chip}
                class="chip"
                aria-pressed={activeChip === chip}
                on:click={() => (activeChip = chip)}
            >
                {chip}
            </button>
        {/each}
    </div>

    <!-- Content Region -->
    {#if loading && allPlaylists.length === 0}
        <!-- Loading Skeletons -->
        <CardGrid minWidth="md" gap="lg">
            {#each Array(6) as _}
                <SkeletonCard />
            {/each}
        </CardGrid>
    {:else if displayedPlaylists.length === 0}
        <!-- Empty State -->
        <section
            class="empty-state flex flex-col gap-md items-center justify-center py-12"
        >
            <Fa icon={faSearch} size="3x" class="text-tertiary" />
            <div class="text-center">
                {#if $playlistsSearch}
                    <h2 class="text-lg font-semibold">
                        No playlists match your search
                    </h2>
                    <p class="text-secondary">
                        Try different keywords or clear your search
                    </p>
                {:else if activeChip === "Managed"}
                    <h2 class="text-lg font-semibold">
                        No managed playlists yet
                    </h2>
                    <p class="text-secondary">
                        Adopt or create playlists to get started
                    </p>
                {:else}
                    <h2 class="text-lg font-semibold">No playlists found</h2>
                    <p class="text-secondary">
                        Create your first playlist to begin
                    </p>
                {/if}
            </div>
        </section>
    {:else}
        <!-- Playlist Grid with Production Design System -->
        <CardGrid minWidth="md" gap="lg" class="container-query">
            {#each displayedPlaylists as p (p.id)}
                <Card
                    interactive
                    elevated
                    glow
                    onClick={() => openInEditor(p)}
                >
                    <!-- Thumbnail Section -->
                    <div
                        class="relative aspect-video rounded-lg overflow-hidden bg-surface-200 group"
                    >
                        {#if p.thumbnailUrl}
                            <img alt={p.title}
                                src={p.thumbnailUrl}
                                loading="lazy"
                                decoding="async"
                                class="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                            />
                        {:else}
                            <div
                                class="flex items-center justify-center text-tertiary h-full"
                                aria-hidden="true"
                            >
                                <Fa icon={faListUl} size="2x" />
                            </div>
                        {/if}

                        <!-- View Overlay -->
                        <div
                            class="absolute inset-0 bg-scrim opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                            aria-hidden="true"
                        >
                            <span
                                class="text-white text-sm font-semibold px-3 py-2 rounded-full bg-overlay border border-glass-border"
                            >
                                View Playlist
                            </span>
                        </div>

                        <!-- Video Count Badge -->
                        <div
                            class="absolute bottom-3 right-3 bg-overlay text-white text-xs font-semibold px-3 py-1 rounded-md flex items-center gap-2"
                            aria-label={`${p.videoCount} videos`}
                        >
                            <Fa icon={faListUl} fw />
                            <span>{p.videoCount}</span>
                        </div>

                        <!-- Status Badges -->
                        {#if p.isTagged}
                            <div
                                class="absolute top-3 right-3 bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center shadow-md"
                                title="Managed by Playlist Manager"
                                aria-label="Managed by Playlist Manager"
                            >
                                <Fa icon={faWrench} fw size="sm" />
                            </div>
                        {/if}

                        {#if p.isLocal}
                            <div
                                class="absolute top-3 left-3 bg-warning text-white text-xs font-semibold px-2 py-1 rounded-md flex items-center gap-1"
                                title="Stored offline"
                            >
                                <Fa icon={faFile} fw />
                                OFFLINE
                            </div>
                        {/if}

                        {#if settings && p.id === settings.watchLaterPlaylistId}
                            <div
                                class="absolute bottom-3 left-3 text-2xl"
                                title="Your Favorite Playlist"
                                aria-label="Favorite playlist"
                            >
                                ⭐️
                            </div>
                        {/if}
                    </div>

                    <!-- Details Section -->
                    <div class="flex flex-col gap-sm flex-1 mt-4">
                        <h3
                            class="text-base font-semibold text-primary line-clamp-2"
                        >
                            {p.title || "Untitled Playlist"}
                        </h3>

                        <p class="text-sm text-secondary">
                            Created {new Date(
                                p.timestamp * 1000,
                            ).toLocaleDateString()}
                        </p>

                        <!-- Action Buttons -->
                        <div class="flex gap-sm mt-auto pt-2 flex-wrap">
                            <button
                                class="btn btn-primary flex-1"
                                on:click|stopPropagation={() => openInEditor(p)}
                                aria-label="Open playlist in editor"
                            >
                                <Fa icon={faArrowUpRightFromSquare} fw />
                                <span>Open</span>
                            </button>

                            {#if !p.isTagged && !p.isLocal && signedIn}
                                <button
                                    class="btn btn-secondary flex-1"
                                    on:click|stopPropagation={() =>
                                        requestAdopt(p)}
                                    disabled={adoptingId === p.id}
                                    aria-label={adoptingId === p.id
                                        ? "Adopting..."
                                        : "Adopt this playlist"}
                                >
                                    {adoptingId === p.id
                                        ? "Adopting…"
                                        : "Adopt"}
                                </button>
                            {/if}

                            {#if p.isLocal && signedIn}
                                <button
                                    class="btn btn-secondary flex-1"
                                    on:click|stopPropagation={() =>
                                        requestSync(p)}
                                    disabled={syncingId === p.id}
                                    aria-label={syncingId === p.id
                                        ? "Syncing..."
                                        : "Sync to YouTube"}
                                >
                                    <Fa icon={faCloud} fw />
                                    <span
                                        >{syncingId === p.id
                                            ? "Syncing…"
                                            : "Sync"}</span
                                    >
                                </button>
                            {/if}
                        </div>
                    </div>
                </Card>
            {/each}
        </CardGrid>
    {/if}

    <!-- Offline Notice -->
    {#if !signedIn && allPlaylists.length > 0}
        <div
            class="mt-6 rounded-lg border border-warning bg-warning-light p-4 flex gap-3 items-start"
        >
            <Fa
                icon={faCloud}
                fw
                size="lg"
                class="text-warning flex-shrink-0 mt-1"
            />
            <div class="flex-1">
                <p class="text-sm text-warning font-semibold">
                    Showing offline playlists
                </p>
                <p class="text-xs text-secondary mt-1">
                    <button
                        class="text-primary font-semibold hover:underline"
                        on:click={triggerSignIn}
                    >
                        Sign in to YouTube
                    </button>
                    to sync your playlists and access all features.
                </p>
            </div>
        </div>
    {/if}
</main>

<style>
    main {
        max-width: var(--max-width);
        margin: 0 auto;
    }

    .sort-wrapper {
        position: relative;
        display: inline-flex;
        flex-shrink: 0;
    }

    .chip {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: var(--spacing-2) var(--spacing-4);
        border-radius: var(--radius-xl);
        border: 1px solid var(--color-border);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
        background: var(--color-surface-100);
        color: var(--color-text-primary);
        transition: var(--transition-colors);
    }

    .chip:hover:not(.active) {
        background: var(--color-surface-200);
    }

    .chip.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
    }

    .chip.sort-open {
        background: var(--color-surface-200);
    }

    .chip :global(svg) {
        transition: transform var(--duration-200) var(--timing-ease-out);
    }

    .chip.sort-open :global(svg) {
        transform: rotate(180deg);
    }

    .sort-dropdown {
        position: absolute;
        top: calc(100% + var(--spacing-2));
        left: 0;
        z-index: var(--z-modal);
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        width: min(100vw - var(--spacing-8), 240px);
        overflow: hidden;
        animation: slideInDown var(--duration-200) var(--timing-ease-out);
    }

    .sort-option {
        display: flex;
        align-items: center;
        width: 100%;
        padding: var(--spacing-3) var(--spacing-4);
        border: none;
        background: none;
        color: var(--color-text-primary);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        text-align: left;
        transition: var(--transition-colors);
    }

    .sort-option:hover {
        background: var(--color-surface-200);
    }

    .sort-option.selected {
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
    }

    .empty-state {
        min-height: 400px;
        animation: fadeIn var(--duration-300) var(--timing-ease-out);
    }

    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-2);
        padding: var(--spacing-2) var(--spacing-4);
        border-radius: var(--radius-lg);
        border: 1px solid transparent;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
        transition:
            var(--transition-colors),
            box-shadow var(--duration-200) var(--timing-ease-out);
        white-space: nowrap;
        min-height: var(--size-button-md);
    }

    .btn:disabled {
        opacity: var(--state-disabled);
        cursor: not-allowed;
    }

    .btn:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
    }

    .btn-primary {
        background: var(--color-primary);
        color: white;
    }

    .btn-primary:hover:not(:disabled) {
        background: var(--color-primary-hover);
        box-shadow: var(--glow-primary);
    }

    .btn-secondary {
        background: var(--color-surface-200);
        color: var(--color-text-primary);
        border-color: var(--color-border);
    }

    .btn-secondary:hover:not(:disabled) {
        background: var(--color-surface-300);
    }

    @media (prefers-reduced-motion: reduce) {
        .chip :global(svg),
        .sort-dropdown,
        .empty-state {
            animation: none;
            transition: none;
        }
    }

    /* Dark theme adjustments */
    @media (prefers-color-scheme: dark) {
        .chip {
            background: var(--color-surface-200);
            border-color: var(--color-surface-300);
        }

        .chip:hover:not(.active) {
            background: var(--color-surface-300);
        }

        .btn-secondary {
            background: var(--color-surface-300);
            border-color: var(--color-surface-200);
        }

        .btn-secondary:hover:not(:disabled) {
            background: var(--color-surface-200);
        }
    }

    /* Container query responsive behavior */
    @container (max-width: 20rem) {
        :global(.card) {
            padding: var(--spacing-4);
        }
    }

    /* Mobile adjustments */
    @media (max-width: 640px) {
        main {
            padding: var(--spacing-4) !important;
        }

        .sticky-header {
            margin: 0 calc(var(--spacing-4) * -1);
            padding: var(--spacing-3) var(--spacing-4);
        }

        .btn {
            font-size: var(--font-size-xs);
            padding: var(--spacing-2) var(--spacing-3);
        }
    }
</style>
