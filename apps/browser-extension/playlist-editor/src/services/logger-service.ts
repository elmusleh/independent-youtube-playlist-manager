// logger-service.ts
// Centralized system logger for the Independent YouTube Playlist Manager extension
// Provides .info, .warn, .error methods with structured format and storage cap.

interface LogEntry {
  timestamp: string; // ISO string
  module: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  action: string;
  details?: any;
}

class SystemLoggerClass {
  private readonly storageKey = 'yph_system_logs';
  private readonly maxEntries = 1000;

  private async getLogs(): Promise<LogEntry[]> {
    if (typeof browser === 'undefined') return [];
    const result = await browser.storage.local.get(this.storageKey);
    return (result[this.storageKey] as LogEntry[]) || [];
  }

  private async saveLogs(logs: LogEntry[]): Promise<void> {
    if (typeof browser === 'undefined') return;
    await browser.storage.local.set({ [this.storageKey]: logs });
    // Notify UI components
    const event = new CustomEvent('system-log-updated', { detail: logs[logs.length - 1] });
    window.dispatchEvent(event);
  }

  private async append(entry: LogEntry): Promise<void> {
    const logs = await this.getLogs();
    logs.push(entry);
    if (logs.length > this.maxEntries) {
      logs.splice(0, logs.length - this.maxEntries);
    }
    await this.saveLogs(logs);
  }

  private format(module: string, action: string, details?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      module,
      level: 'INFO',
      action,
      details,
    };
  }

  async info(module: string, action: string, details?: any): Promise<void> {
    const entry = this.format(module, action, details);
    entry.level = 'INFO';
    await this.append(entry);
  }

  async warn(module: string, action: string, details?: any): Promise<void> {
    const entry = this.format(module, action, details);
    entry.level = 'WARN';
    await this.append(entry);
  }

  async error(module: string, action: string, details?: any): Promise<void> {
    const entry = this.format(module, action, details);
    entry.level = 'ERROR';
    await this.append(entry);
  }
}

// Expose as a global singleton for easy import across the codebase
export const SystemLogger = new SystemLoggerClass();

// Attach to window for legacy usage (e.g., window.SystemLogger)
if (typeof window !== 'undefined') {
  (window as any).SystemLogger = SystemLogger;
}
