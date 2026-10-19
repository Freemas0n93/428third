import { create } from 'zustand'
import { CATALOG_BY_KEY } from '../data/catalog'

/** A catalog item placed in the scene. Position is the object's footprint center on the floor. */
export interface PlacedObject {
  id: string
  catalogKey: string
  label: string
  x: number
  z: number
  rotY: number // radians
  hex: string
  locked: boolean
}

export type ViewPreset = 'overview' | 'plan' | 'entrance'

/**
 * Placeholder building envelope until the scan is in (meters).
 * Origin at floor center, +Z toward the street-facing wall.
 * Replaced on Day 1 by the calibrated scan GLB.
 */
export const PLACEHOLDER_ROOM = {
  width: 18, // x
  depth: 10, // z
  height: 4.2, // y
  wallThickness: 0.2,
  storefrontWidth: 8,
}

interface SceneState {
  objects: PlacedObject[]
  selectedId: string | null
  view: ViewPreset
  scanLoaded: boolean

  addObject: (catalogKey: string, at?: { x: number; z: number }) => string
  updateObject: (id: string, patch: Partial<Omit<PlacedObject, 'id'>>) => void
  removeObject: (id: string) => void
  duplicateObject: (id: string) => void
  select: (id: string | null) => void
  setView: (view: ViewPreset) => void
}

let counter = 0
function nextId(prefix: string) {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

function seedObjects(): PlacedObject[] {
  const seed: Array<[string, number, number, number]> = [
    // catalogKey, x, z, rotY
    ['reception-desk', -6.5, 3.2, 0],
    ['robot-cell', 4.5, 0.5, 0],
    ['humanoid-stand', -1.5, 1.5, 0],
    ['display-plinth', -3.0, 1.5, 0],
    ['display-75', 0, -4.3, 0],
    ['sofa-3', -5.5, -2.5, Math.PI],
    ['coffee-table', -5.5, -1.2, 0],
    ['lounge-chair', -7.6, -1.6, Math.PI / 2],
    ['bar-3m', 6.5, -3.8, 0],
    ['planter-l', 8.2, 4.2, 0],
    ['planter-l', -8.2, 4.2, 0],
  ]
  return seed.map(([catalogKey, x, z, rotY]) => {
    const item = CATALOG_BY_KEY[catalogKey]
    return {
      id: nextId('obj'),
      catalogKey,
      label: item.name,
      x,
      z,
      rotY,
      hex: item.hex,
      locked: false,
    }
  })
}

export const useScene = create<SceneState>((set, get) => ({
  objects: seedObjects(),
  selectedId: null,
  view: 'overview',
  scanLoaded: false,

  addObject: (catalogKey, at) => {
    const item = CATALOG_BY_KEY[catalogKey]
    if (!item) throw new Error(`Unknown catalog key: ${catalogKey}`)
    const id = nextId('obj')
    const n = get().objects.length
    // Stagger new objects slightly so repeated adds don't stack exactly.
    const x = at?.x ?? ((n % 5) - 2) * 0.6
    const z = at?.z ?? 0
    set((s) => ({
      objects: [
        ...s.objects,
        { id, catalogKey, label: item.name, x, z, rotY: 0, hex: item.hex, locked: false },
      ],
      selectedId: id,
    }))
    return id
  },

  updateObject: (id, patch) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    })),

  removeObject: (id) =>
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  duplicateObject: (id) => {
    const src = get().objects.find((o) => o.id === id)
    if (!src) return
    const item = CATALOG_BY_KEY[src.catalogKey]
    const copy: PlacedObject = {
      ...src,
      id: nextId('obj'),
      x: src.x + (item?.w ?? 1) + 0.2,
      locked: false,
    }
    set((s) => ({ objects: [...s.objects, copy], selectedId: copy.id }))
  },

  select: (id) => set({ selectedId: id }),
  setView: (view) => set({ view }),
}))
