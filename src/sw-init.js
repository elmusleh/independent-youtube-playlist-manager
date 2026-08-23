// Initialize global window object for service worker context
// This allows shared code that expects 'window' to work in the worker.
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}
