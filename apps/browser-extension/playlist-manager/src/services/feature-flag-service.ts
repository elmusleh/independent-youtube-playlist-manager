import { writable } from "svelte/store";
declare const browser: any;
// Simple check if running in a browser context
const isBrowser = typeof browser !== "undefined";

/**
 * Feature flags for enabling/disabling experimental features.
 * Flags are stored in browser.storage.sync (or local if sync not available).
 */
class FeatureFlagService {
  private flags = writable<Record<string, boolean>>({});
  private defaults: Record<string, boolean> = {
    // Example experimental feature flags
    "experimental-sync-improvements": false,
    "experimental-ui-refresh": false,
    "experimental-api-first-metadata": false,
  };

  constructor() {
    if (isBrowser) {
      this.loadFlags();
    }
  }

  /**
   * Load feature flags from storage
   */
  private async loadFlags() {
    try {
      // Try to get from sync storage first
      const syncResult = await browser.storage.sync.get("featureFlags");
      if (
        syncResult &&
        Object.keys(syncResult).length > 0 &&
        syncResult.featureFlags !== undefined
      ) {
        // Merge with defaults to ensure all known flags exist
        const merged = { ...this.defaults, ...syncResult.featureFlags };
        this.flags.set(merged);
        return;
      }
      // Fallback to local storage
      const localResult = await browser.storage.local.get("featureFlags");
      if (
        localResult &&
        Object.keys(localResult).length > 0 &&
        localResult.featureFlags !== undefined
      ) {
        const merged = { ...this.defaults, ...localResult.featureFlags };
        this.flags.set(merged);
        return;
      }
      // No stored flags, use defaults
      this.flags.set(this.defaults);
    } catch (error) {
      console.warn("Failed to load feature flags, using defaults:", error);
      this.flags.set(this.defaults);
    }
  }

  /**
   * Save feature flags to storage
   */
  private async saveFlags(flags: Record<string, boolean>) {
    try {
      // Try to save to sync storage first
      await browser.storage.sync.set({ featureFlags: flags });
    } catch (syncError) {
      // If sync fails (e.g., quota exceeded or not allowed), fall back to local storage
      try {
        await browser.storage.local.set({ featureFlags: flags });
      } catch (localError) {
        console.error("Failed to save feature flags to both sync and local storage:", {
          syncError,
          localError,
        });
      }
    }
  }

  /**
   * Check if a feature is enabled
   * @param featureId - The feature flag identifier
   * @returns true if enabled, false otherwise
   */
  isEnabled(featureId: string): boolean {
    let enabled = false;
    this.flags.subscribe((value) => {
      enabled = value[featureId] ?? this.defaults[featureId] ?? false;
    })();
    return enabled;
  }

  /**
   * Set a feature flag to enabled or disabled
   * @param featureId - The feature flag identifier
   * @param enabled - Whether to enable the feature
   */
  async setEnabled(featureId: string, enabled: boolean): Promise<void> {
    const current = await new Promise<Record<string, boolean>>((resolve) => {
      this.flags.subscribe((value) => {
        resolve({ ...value });
      })();
    });

    const updated = { ...current, [featureId]: enabled };
    this.flags.set(updated);
    await this.saveFlags(updated);
  }

  /**
   * Get all feature flags
   * @returns Promise resolving to all feature flags
   */
  async getAll(): Promise<Record<string, boolean>> {
    return new Promise((resolve) => {
      this.flags.subscribe((value) => {
        resolve({ ...value });
      })();
    });
  }
}

// Create and export a singleton instance
export const featureFlagService = new FeatureFlagService();
