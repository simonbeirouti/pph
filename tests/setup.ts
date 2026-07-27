import "@testing-library/jest-dom/vitest"

class TestResizeObserver implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

globalThis.ResizeObserver = TestResizeObserver

if (typeof Element !== "undefined" && !Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}
