import { create } from 'zustand'

export type LayerStatus = 'loading' | 'ready' | 'error'

interface ModelState {
  status: Record<string, LayerStatus>
  /** Bytes received so far per layer (from XHR progress). */
  received: Record<string, number>
  setStatus: (id: string, status: LayerStatus) => void
  setReceived: (id: string, bytes: number) => void
}

/** Load state of the building layers, kept apart from the scene store so progress ticks don't re-render it. */
export const useModel = create<ModelState>((set) => ({
  status: {},
  received: {},
  setStatus: (id, status) => set((s) => ({ status: { ...s.status, [id]: status } })),
  setReceived: (id, bytes) => set((s) => ({ received: { ...s.received, [id]: bytes } })),
}))
