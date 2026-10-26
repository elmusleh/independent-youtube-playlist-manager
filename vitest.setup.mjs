// Node >= 22.4 ships an experimental `localStorage` global that resolves to
// `undefined` unless the process is started with `--localstorage-file`.
//
// Vitest's jsdom environment copies jsdom's window keys onto globalThis with
// `populateGlobal()`, but it *skips* any key that Node already defines — so the
// broken Node getter wins and bare `localStorage` is undefined everywhere
// (vitest then sets `globalThis.window = globalThis`, which is why
// `window.localStorage` is undefined too).
//
// Re-point the global at the real Storage instance owned by the jsdom window.
const storage = globalThis.jsdom?.window?.localStorage;

if (storage) {
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
}
