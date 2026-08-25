export class StatusManager {
  isDirty = $state(false);
  lastChange = $state(0);
  saving = $state(false);
  refreshing = $state(false);
  lastUpdated = $state<number | null>(null);
  lastSuccess = $state<number | null>(null);
  error = $state<string | null>(null);
  progress = $state<number | null>(null);

  get hasSavedOnce() {
    return this.lastUpdated !== null;
  }

  async refresh<T>(refreshFn: () => Promise<T>): Promise<T> {
    this.refreshing = true;
    this.error = null;
    try {
      const result = await refreshFn();
      const now = Date.now();
      this.lastUpdated = now;
      this.lastSuccess = now;
      return result;
    } catch (e: any) {
      this.error = e.message || String(e);
      throw e;
    } finally {
      this.refreshing = false;
    }
  }

  async save<T>(saveFn: () => Promise<T>, options: { silent?: boolean } = {}): Promise<T> {
    if (!options.silent) this.saving = true;
    this.error = null;
    try {
      const result = await saveFn();
      const now = Date.now();
      this.lastUpdated = now;
      this.lastSuccess = now;
      this.isDirty = false;
      return result;
    } catch (e: any) {
      this.error = e.message || String(e);
      throw e;
    } finally {
      this.saving = false;
    }
  }

  markDirty() {
    this.isDirty = true;
    this.lastChange = Date.now();
  }

  resetDirty() {
    this.isDirty = false;
    this.lastChange = 0;
    this.error = null;
  }
}
