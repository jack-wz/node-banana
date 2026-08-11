import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Mock ResizeObserver for React Flow tests
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = ResizeObserverMock;

// Mock DOMMatrixReadOnly for React Flow
class DOMMatrixReadOnlyMock {
  m22: number = 1;
  constructor() {
    this.m22 = 1;
  }
}

global.DOMMatrixReadOnly = DOMMatrixReadOnlyMock as unknown as typeof DOMMatrixReadOnly;

// Node ships a native `localStorage` global (functional only with
// --localstorage-file), which shadows jsdom's real one: vitest's jsdom
// environment only copies a window key onto the test global when it's
// already present there if that key is on its own hardcoded allowlist, and
// `localStorage` isn't on it. Without this, every test that touches
// localStorage fails with "localStorage.getItem is not a function".
// Vitest stashes the jsdom instance at globalThis.jsdom, so pull the real
// (working, genuinely `instanceof Storage`) localStorage from there rather
// than hand-rolling a mock — tests that spy on `Storage.prototype` need the
// real prototype chain.
const jsdomLocalStorage = (globalThis as { jsdom?: { window: { localStorage: Storage } } }).jsdom
  ?.window.localStorage;

if (jsdomLocalStorage) {
  Object.defineProperty(globalThis, "localStorage", {
    value: jsdomLocalStorage,
    writable: true,
    configurable: true,
  });
}

// Cleanup after each test to ensure DOM is reset
afterEach(() => {
  cleanup();
  jsdomLocalStorage?.clear();
});
