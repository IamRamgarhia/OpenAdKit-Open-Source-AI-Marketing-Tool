/**
 * Minimal browser globals for node-environment tests: an in-memory
 * localStorage plus a `window` with event plumbing. WebCrypto (crypto.subtle),
 * btoa/atob and TextEncoder are already native in Node 24.
 */
export class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(i: number) {
    return Array.from(this.map.keys())[i] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

export function installBrowserShim(): MemoryStorage {
  const storage = new MemoryStorage();
  const target = new EventTarget();
  const win = {
    localStorage: storage,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    location: { origin: "http://localhost" },
  };
  (globalThis as any).window = win;
  (globalThis as any).localStorage = storage;
  return storage;
}

export function removeBrowserShim(): void {
  delete (globalThis as any).window;
  delete (globalThis as any).localStorage;
}
