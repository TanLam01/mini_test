// jsdom không có ResizeObserver, trong khi các component layout/overlay của Vuetify cần nó.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
