import { create } from 'zustand'
import { CATALOG_BY_KEY } from '../data/catalog'
import { LAYER_GROUPS, LEVELS, STATION_GRID, type LevelMode } from '../data/building'

/**
 * A catalog item placed in the scene. (x, y, z) is the footprint center on the floor it
 * stands on, in the building frame (see src/data/building.ts). y = that floor's elevation.
 */
export interface PlacedObject {
  id: string
  catalogKey: string
  label: string
  x: number
  y: number
  z: number
  rotY: number // radians
  hex: string
  locked: boolean
}

export type ViewPreset = 'overview' | 'plan' | 'hall' | 'mezzanine'

interface SceneState {
  objects: PlacedObject[]
  selectedId: string | null
  view: ViewPreset
  /** Bumped on every setView so re-clicking a preset re-frames the camera. */
  viewNonce: number
  level: LevelMode
  /** Section cut-away at the current level's cut height (ignored when level = 'all'). */
  cut: boolean
  layers: Record<string, boolean>
  showStationGrid: boolean

  addObject: (catalogKey: string, at?: { x: number; z: number }) => string
  updateObject: (id: string, patch: Partial<Omit<PlacedObject, 'id'>>) => void
  removeObject: (id: string) => void
  duplicateObject: (id: string) => void
  select: (id: string | null) => void
  setView: (view: ViewPreset) => void
  setLevel: (level: LevelMode) => void
  setCut: (on: boolean) => void
  setLayer: (key: string, on: boolean) => void
  setShowStationGrid: (on: boolean) => void
}

let counter = 0
function nextId(prefix: string) {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** The accepted 16-station layout: one 60×30" table + one 36×31" chair per 2.0 × 2.5 m cell. */
function seedStations(): PlacedObject[] {
  const g = STATION_GRID
  const table = CATALOG_BY_KEY['station-table']
  const chair = CATALOG_BY_KEY['station-chair']
  const out: PlacedObject[] = []
  for (let s = 0; s < g.cols * g.rows; s++) {
    const col = g.cols - 1 - Math.floor(s / g.rows) // station 01 sits in the column farthest from the front
    const row = s % g.rows
    const cellX = g.x0 + col * g.cellX
    const z = g.z0 + row * g.cellZ + g.cellZ / 2
    const n = pad2(s + 1)
    // Both items are rotated 90° so their long side runs across the hall (along Z).
    out.push({
      id: nextId('obj'),
      catalogKey: table.key,
      label: `Station ${n}`,
      x: cellX + g.tableOffsetX,
      y: 0,
      z,
      rotY: Math.PI / 2,
      hex: table.hex,
      locked: false,
    })
    out.push({
      id: nextId('obj'),
      catalogKey: chair.key,
      label: `Chair ${n}`,
      x: cellX + g.chairOffsetX,
      y: 0,
      z,
      rotY: Math.PI / 2,
      hex: chair.hex,
      locked: false,
    })
  }
  return out
}

const defaultLayers = Object.fromEntries(LAYER_GROUPS.map((g) => [g.key, g.defaultOn]))

/** Views that are only useful with the full building visible switch the level to 'all'. */
const VIEW_LEVEL: Partial<Record<ViewPreset, LevelMode>> = { hall: 'all', mezzanine: 'all' }

export const useScene = create<SceneState>((set, get) => ({
  objects: seedStations(),
  selectedId: null,
  view: 'overview',
  viewNonce: 0,
  level: 'ground',
  cut: true,
  layers: defaultLayers,
  showStationGrid: true,

  addObject: (catalogKey, at) => {
    const item = CATALOG_BY_KEY[catalogKey]
    if (!item) throw new Error(`Unknown catalog key: ${catalogKey}`)
    const id = nextId('obj')
    const { level, objects } = get()
    const lv = LEVELS[level === 'all' ? 'ground' : level]
    // Stagger new objects slightly so repeated adds don't stack exactly.
    const n = objects.length
    const x = at?.x ?? lv.dropPoint.x + ((n % 5) - 2) * 0.6
    const z = at?.z ?? lv.dropPoint.z
    set((s) => ({
      objects: [
        ...s.objects,
        { id, catalogKey, label: item.name, x, y: lv.floorY, z, rotY: 0, hex: item.hex, locked: false },
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
  setView: (view) =>
    set((s) => ({ view, viewNonce: s.viewNonce + 1, level: VIEW_LEVEL[view] ?? s.level })),
  setLevel: (level) => set({ level }),
  setCut: (cut) => set({ cut }),
  setLayer: (key, on) => set((s) => ({ layers: { ...s.layers, [key]: on } })),
  setShowStationGrid: (showStationGrid) => set({ showStationGrid }),
}))
