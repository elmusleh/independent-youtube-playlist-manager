const FILE_NAME = "extension_data.json";
const TMP_FILE_NAME = "extension_data.tmp.json";
const HANDLE_DB_KEY = "storage_dir_handle";

export class StorageManager {
  mode: "browser" | "local" = "browser";
  dirHandle: FileSystemDirectoryHandle | null = null;
  memoryCache: Record<string, any> | null = null;
  writeTimeout: ReturnType<typeof setTimeout> | null = null;
  needsAuth: boolean = false;

  async init() {
    try {
      const chrome = window.browser || window.chrome;
      const res = chrome?.storage?.local ? await chrome.storage.local.get(HANDLE_DB_KEY) : {};
      const handle = res[HANDLE_DB_KEY];
      if (handle) {
        const hasPermission = await this.verifyPermission(
          handle as FileSystemDirectoryHandle,
          false
        );
        if (hasPermission) {
          this.dirHandle = handle as FileSystemDirectoryHandle;
          this.mode = "local";
          this.needsAuth = false;
          await this.loadFromDisk();
          return;
        } else {
          this.needsAuth = true;
        }
      }
    } catch (e) {
      console.warn("Failed to initialize local storage, falling back to browser", e);
    }

    this.mode = "browser";
    this.dirHandle = null;
    await this.loadFromBrowserStorage();
  }

  async verifyPermission(
    fileHandle: FileSystemDirectoryHandle,
    requestIfMissing = false
  ): Promise<boolean> {
    const opts = { mode: "readwrite" };
    const handleAny = fileHandle as any;
    if ((await handleAny.queryPermission(opts)) === "granted") {
      return true;
    }
    if (requestIfMissing && (await handleAny.requestPermission(opts)) === "granted") {
      return true;
    }
    return false;
  }

  async connectFolder(): Promise<boolean> {
    if (!("showDirectoryPicker" in window)) {
      throw new Error("File System Access API is not supported in this browser.");
    }

    try {
      const handle = await window.showDirectoryPicker!({ mode: "readwrite" });
      this.dirHandle = handle;
      const chrome = window.browser || window.chrome;
      if (chrome?.storage?.local) {
        await chrome.storage.local.set({ [HANDLE_DB_KEY]: handle });
      }
      this.mode = "local";

      const existingBrowserData = await this.getBrowserStorageData();
      await this.loadFromDisk();

      if (existingBrowserData && Object.keys(existingBrowserData).length > 0) {
        this.memoryCache = { ...existingBrowserData, ...(this.memoryCache || {}) };
        await this.triggerWrite();
      }

      return true;
    } catch (e) {
      console.warn("User cancelled or failed to pick directory", e);
      return false;
    }
  }

  async disconnectFolder(): Promise<void> {
    const chrome = window.browser || window.chrome;
    if (chrome?.storage?.local) {
      await chrome.storage.local.remove(HANDLE_DB_KEY);
    }
    this.dirHandle = null;
    this.mode = "browser";
    await this.loadFromBrowserStorage();
  }

  async getBrowserStorageData(): Promise<Record<string, unknown>> {
    const chrome = window.browser || window.chrome;
    return new Promise((resolve) => {
      // Chrome MV3 uses promise-based API; cast through unknown for callback compatibility
      void (
        chrome.storage.local.get(null as unknown as undefined) as unknown as Promise<
          Record<string, unknown>
        >
      ).then((items) => resolve(items || {}));
    });
  }

  async loadFromBrowserStorage() {
    this.memoryCache = await this.getBrowserStorageData();
  }

  async loadFromDisk() {
    if (!this.dirHandle) return;
    try {
      const fileHandle = await this.dirHandle.getFileHandle(FILE_NAME, { create: true });
      const file = await fileHandle.getFile();
      const text = await file.text();
      this.memoryCache = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error("Error loading from disk:", e);
      this.memoryCache = {};
    }
  }

  get(key: string) {
    return this.memoryCache ? this.memoryCache[key] : null;
  }

  async set(key: string, value: any) {
    if (!this.memoryCache) this.memoryCache = {};
    this.memoryCache[key] = value;
    this.memoryCache.lastUpdated = Date.now();

    if (this.mode === "browser") {
      const chrome = window.browser || window.chrome;
      return new Promise((resolve) => {
        // Chrome MV3 uses promise-based API; cast through unknown for callback compatibility
        void (
          chrome.storage.local.set({
            [key]: value,
            lastUpdated: this.memoryCache!.lastUpdated,
          }) as unknown as Promise<void>
        ).then(() => resolve(undefined));
      });
    } else {
      return this.debounceWrite();
    }
  }

  async triggerWrite() {
    if (this.mode === "local") {
      return this.performWrite(JSON.stringify(this.memoryCache));
    }
  }

  debounceWrite(): Promise<void> {
    if (this.writeTimeout) clearTimeout(this.writeTimeout);

    const dataToWrite = JSON.stringify(this.memoryCache);

    return new Promise<void>((resolve, reject) => {
      this.writeTimeout = setTimeout(async () => {
        try {
          await this.performWrite(dataToWrite);
          resolve();
        } catch (e) {
          reject(e);
        }
      }, 500);
    });
  }

  async performWrite(dataString: string, attempt = 1): Promise<void> {
    if (!this.dirHandle) throw new Error("No directory handle available");

    try {
      const fileHandle = await this.dirHandle.getFileHandle(FILE_NAME, { create: true });
      const file = await fileHandle.getFile();
      const text = await file.text();

      if (text) {
        try {
          const diskData = JSON.parse(text);
          if (diskData.lastUpdated && diskData.lastUpdated > this.memoryCache!.lastUpdated) {
            const error: any = new Error("Disk data is newer than memory data");
            error.code = "SYNC_CONFLICT";
            error.diskData = diskData;
            throw error;
          }
        } catch (e: any) {
          if (e.code === "SYNC_CONFLICT") throw e;
        }
      }

      const tmpFileHandle = await this.dirHandle.getFileHandle(TMP_FILE_NAME, { create: true });
      const writableTemp = await (tmpFileHandle as any).createWritable();
      await writableTemp.write(dataString);
      await writableTemp.close();

      const writableMain = await (fileHandle as any).createWritable();
      await writableMain.write(dataString);
      await writableMain.close();

      await this.dirHandle.removeEntry(TMP_FILE_NAME);
    } catch (e: any) {
      if (e.code === "SYNC_CONFLICT") throw e;

      if (attempt <= 3) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(`Write locked or failed. Retrying in ${delay}ms... (Attempt ${attempt}/3)`, e);
        await new Promise((res) => setTimeout(res, delay));
        return this.performWrite(dataString, attempt + 1);
      } else {
        throw new Error("Failed to write after 3 retries: " + e.message);
      }
    }
  }
}

export const storageManager = new StorageManager();
