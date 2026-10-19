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

/** Grid snap step in meters; 0 = off. Grid origin is datum A (the hall corner). */
export type SnapStep = 0 | 0.1 | 0.5
export const SNAP_STEPS: SnapStep[] = [0, 0.1, 0.5]

export const ROTATE_STEP = Math.PI / 12 // 15°
export const NUDGE_STEP = 0.1
export const NUDGE_STEP_LARGE = 0.5

interface SceneState {
  objects: PlacedObject[]
  selectedId: string | null
  /** Id of the object currently being dragged (orbit controls pause while set). */
  draggingId: string | null
  snap: SnapStep
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
  /** Place the footprint center at (x, z) on the object's floor, honoring the snap setting. Ignored when locked. */
  moveObject: (id: string, x: number, z: number) => void
  /** Shift by (dx, dz) meters without snapping. Ignored when locked. */
  nudgeObject: (id: string, dx: number, dz: number) => void
  /** Rotate about the footprint center by `delta` radians. Ignored when locked. */
  rotateObject: (id: string, delta: number) => void
  toggleLock: (id: string) => void
  removeObject: (id: string) => void
  duplicateObject: (id: string) => void
  select: (id: string | null) => void
  setDragging: (id: string | null) => void
  setSnap: (snap: SnapStep) => void
  setView: (view: ViewPreset) => void
  setLevel: (level: LevelMode) => void
  setCut: (on: boolean) => void
  setLayer: (key: string, on: boolean) => void
  setShowStationGrid: (on: boolean) => void
}

/** Round to mm so repeated 0.1 m nudges don't accumulate float noise. */
const mm = (v: number) => Math.round(v * 1000) / 1000
const snapTo = (v: number, step: SnapStep) => (step > 0 ? mm(Math.round(v / step) * step) : mm(v))
const TAU = Math.PI * 2
const normRot = (r: number) => ((r % TAU) + TAU) % TAU

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
  draggingId: null,
  snap: 0.1,
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

  moveObject: (id, x, z) =>
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id && !o.locked ? { ...o, x: snapTo(x, s.snap), z: snapTo(z, s.snap) } : o,
      ),
    })),

  nudgeObject: (id, dx, dz) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id && !o.locked ? { ...o, x: mm(o.x + dx), z: mm(o.z + dz) } : o)),
    })),

  rotateObject: (id, delta) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id && !o.locked ? { ...o, rotY: normRot(o.rotY + delta) } : o)),
    })),

  toggleLock: (id) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, locked: !o.locked } : o)),
      draggingId: s.draggingId === id ? null : s.draggingId,
    })),

  removeObject: (id) =>
    set((s) => {
      const target = s.objects.find((o) => o.id === id)
      if (!target || target.locked) return s
      return {
        objects: s.objects.filter((o) => o.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
        draggingId: s.draggingId === id ? null : s.draggingId,
      }
    }),

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
  setDragging: (draggingId) => set({ draggingId }),
  setSnap: (snap) => set({ snap }),
  setView: (view) =>
    set((s) => ({ view, viewNonce: s.viewNonce + 1, level: VIEW_LEVEL[view] ?? s.level })),
  setLevel: (level) => set({ level }),
  setCut: (cut) => set({ cut }),
  setLayer: (key, on) => set((s) => ({ layers: { ...s.layers, [key]: on } })),
  setShowStationGrid: (showStationGrid) => set({ showStationGrid }),
}))
