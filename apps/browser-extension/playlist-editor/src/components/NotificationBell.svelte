<script lang="ts">
  import Fa from "svelte-fa";
  import {
    faBell,
    faBellSlash,
    faXmark,
    faRotateRight,
  } from "@fortawesome/free-solid-svg-icons";
  import SimpleButton from "./SimpleButton.svelte";
  import { onDestroy } from "svelte";

  const browser = (window as any).browser || (window as any).chrome;

  let {
    disabled = false,
  }: {
    disabled?: boolean;
  } = $props();

  let open = $state(false);
  let activities: any[] = $state([]);
  let comments: any[] = $state([]);
  let loading = $state(false);
  let cachedNotificationIds = $state<Set<string>>(new Set());

  function toggleDropdown() {
    if (!disabled) {
      open = !open;
      if (open) {
        loadCachedNotifications();
      }
    }
  }

  async function loadCachedNotifications() {
    try {
      const result = await browser.storage.local.get(
        "yph_cached_notifications",
      );
      const cached = result.yph_cached_notifications || {
        ids: [],
        activities: [],
        comments: [],
      };
      cachedNotificationIds = new Set(cached.ids);
      activities = cached.activities || [];
      comments = cached.comments || [];
    } catch (e) {
      console.error("Failed to load cached notifications:", e);
    }
  }

  async function refreshNotifications() {
    if (loading) return;
    loading = true;
    try {
      const [activitiesData, commentsData] = await Promise.all([
        window.getAccountActivities().catch(() => []),
        window.getAccountComments().catch(() => []),
      ]);

      // Filter to show only new notifications (not in cache)
      const newActivities = activitiesData.filter(
        (a: any) => !cachedNotificationIds.has(a.id || a.videoId),
      );
      const newComments = commentsData.filter(
        (c: any) => !cachedNotificationIds.has(c.id),
      );

      activities = newActivities;
      comments = newComments;

      // Update cache with all new IDs
      const newIds = [
        ...activitiesData.map((a: any) => a.id || a.videoId),
        ...commentsData.map((c: any) => c.id),
      ].filter((id: string) => id);

      await browser.storage.local.set({
        yph_cached_notifications: {
          ids: Array.from(new Set([...cachedNotificationIds, ...newIds])),
          activities: activitiesData,
          comments: commentsData,
        },
      });
    } catch (e) {
      console.error("Failed to refresh notifications:", e);
    } finally {
      loading = false;
    }
  }

  function closeDropdown() {
    open = false;
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".notification-container")) {
      closeDropdown();
    }
  }

  window.addEventListener("click", handleClickOutside);
  onDestroy(() => {
    window.removeEventListener("click", handleClickOutside);
  });
</script>

<div class="notification-container">
  <SimpleButton
    onclick={toggleDropdown}
    title={disabled ? "Notifications disabled" : "View notifications"}
    secondary
    {disabled}
    className="notification-bell"
  >
    <Fa icon={disabled ? faBellSlash : faBell} fw />
  </SimpleButton>

  {#if open}
    <div class="notification-dropdown">
      <div class="notification-header">
        <span>Notifications</span>
        <div class="header-actions">
          <button
            class="refresh-btn"
            onclick={refreshNotifications}
            title="Refresh notifications"
          >
            <Fa icon={faRotateRight} />
          </button>
          <button class="close-btn" onclick={closeDropdown}>
            <Fa icon={faXmark} />
          </button>
        </div>
      </div>

      {#if loading}
        <div class="notification-loading">Loading...</div>
      {:else if activities.length === 0 && comments.length === 0}
        <div class="notification-empty">No notifications</div>
      {:else}
        <div class="notification-content">
          {#if activities.length > 0}
            <div class="notification-section">
              <div class="section-title">Recent Activities</div>
              {#each activities.slice(0, 5) as activity}
                <div class="notification-item">
                  <div class="notification-text">{activity.title}</div>
                  <div class="notification-time">
                    {new Date(activity.timestamp).toLocaleString()}
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          {#if comments.length > 0}
            <div class="notification-section">
              <div class="section-title">Recent Comments</div>
              {#each comments.slice(0, 5) as comment}
                <div class="notification-item">
                  <div class="notification-text">{comment.textDisplay}</div>
                  <div class="notification-author">
                    {comment.authorDisplayName}
                  </div>
                  <div class="notification-time">
                    {new Date(comment.publishedAt).toLocaleString()}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .notification-container {
    position: relative;
  }

  :global(.notification-bell) {
    position: relative;
  }

  .notification-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    width: 320px;
    max-height: 400px;
    background-color: var(--background-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    margin-top: 8px;
    z-index: 1000;
    overflow: hidden;
    animation: fadeIn 0.15s ease-out;
  }

  .notification-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    font-weight: 500;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .refresh-btn,
  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
  }

  .refresh-btn:hover,
  .close-btn:hover {
    color: var(--text-color);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .notification-loading,
  .notification-empty {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
  }

  .notification-content {
    max-height: 350px;
    overflow-y: auto;
  }

  .notification-section {
    border-bottom: 1px solid var(--border-color);
  }

  .notification-section:last-child {
    border-bottom: none;
  }

  .section-title {
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .notification-item {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .notification-item:last-child {
    border-bottom: none;
  }

  .notification-text {
    font-size: 14px;
    color: var(--text-color);
    margin-bottom: 4px;
  }

  .notification-author {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 2px;
  }

  .notification-time {
    font-size: 11px;
    color: var(--text-muted);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
