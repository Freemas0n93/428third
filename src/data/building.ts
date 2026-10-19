/**
 * 428 3rd St — building model metadata.
 *
 * World frame (inherited from the v33 corrected export; never re-oriented here):
 *   origin  = datum A, the hall floor corner at the Third St front / Perry St window wall
 *   +X      = along the long window wall, away from the Third St front
 *   +Y      = up
 *   +Z      = across the hall, toward the brick wall
 *   units   = meters
 *
 * Measured from the export (source dimensions, not yet checked against a tape — see scan/README.md).
 */
import { MODEL_FILES } from './modelLayers'

export const MODEL_BASE = '/models/building/'
export const BASIS_PATH = '/basis/'

export type LevelKey = 'ground' | 'upper'
export type LevelMode = LevelKey | 'all'

export interface LevelInfo {
  label: string
  /** Walking surface elevation (m). */
  floorY: number
  /** Section-cut height for the cut-away view (m). Everything above is clipped. */
  cutY: number
  /** Where new objects land when added on this level. */
  dropPoint: { x: number; z: number }
}

export const LEVELS: Record<LevelKey, LevelInfo> = {
  ground: { label: 'Ground', floorY: 0, cutY: 2.4, dropPoint: { x: 18, z: 6.5 } },
  upper: { label: 'Upper', floorY: 2.745, cutY: 4.6, dropPoint: { x: 30.5, z: 16.5 } },
}

/** Objects at or above this elevation belong to the upper level. */
export const UPPER_THRESHOLD_Y = 1.5

export const SITE_DIMS = {
  hall: { x: 34.8, z: 13.0 }, // 1,370 × 512 in
  building: { x: 47.0, z: 24.2 }, // ground-floor footprint incl. back rooms
  floorToFloor: 2.745,
  backRoomCeiling: 2.57,
  hallEaves: 5.6, // roof shell at the walls, approx.
  hallRidge: 7.2, // roof shell at the ridge, approx.
  center: { x: 23.5, z: 12.0 },
}

export type LayerScope = LevelKey | 'site'

export interface LayerGroup {
  key: string
  label: string
  hint: string
  scope: LayerScope
  layers: string[]
  defaultOn: boolean
}

/**
 * Toggleable groups shown in the Layers panel. Each maps to one or more optimized GLBs
 * (ids match the export's layer numbers: 01a = Scan 01 hall, 05s = upper services, …).
 */
export const LAYER_GROUPS: LayerGroup[] = [
  {
    key: 'hall',
    label: 'Hall architecture',
    hint: 'Walls, windows, roof structure, fixtures, cube, stairs',
    scope: 'ground',
    layers: ['02', '03'],
    defaultOn: true,
  },
  {
    key: 'hallScan',
    label: 'Hall scan · current contents',
    hint: 'Furniture and equipment as scanned — off for planning',
    scope: 'ground',
    layers: ['01a'],
    defaultOn: false,
  },
  {
    key: 'backRooms',
    label: 'Back rooms (scan)',
    hint: 'R01–R07, storage, kitchenette passage, restroom',
    scope: 'ground',
    layers: ['01b', '01c', '08'],
    defaultOn: true,
  },
  {
    key: 'upper',
    label: 'Upper floor & mezzanine',
    hint: 'U01–U08, mezzanine, B01 workstations',
    scope: 'upper',
    layers: ['04', '05'],
    defaultOn: true,
  },
  {
    key: 'services',
    label: 'Upper ducts & services',
    hint: 'Clear duct, pipe banks, conduit',
    scope: 'upper',
    layers: ['05s'],
    defaultOn: true,
  },
  {
    key: 'exterior',
    label: 'Exterior & street',
    hint: 'Façades, sidewalk, parking — loads on demand',
    scope: 'site',
    layers: ['06'],
    defaultOn: false,
  },
  {
    key: 'roof',
    label: 'Roof',
    hint: 'Roof shell and rooftop units — loads on demand',
    scope: 'site',
    layers: ['07'],
    defaultOn: false,
  },
]

export interface ModelLayer {
  id: string
  url: string
  bytes: number
  tris: number
  group: LayerGroup
}

export const MODEL_LAYERS: ModelLayer[] = LAYER_GROUPS.flatMap((group) =>
  group.layers.map((id) => {
    const f = MODEL_FILES[id]
    if (!f) throw new Error(`Model layer ${id} missing from modelLayers.ts`)
    return { id, url: MODEL_BASE + f.file, bytes: f.bytes, tris: f.tris, group }
  }),
)

export function groupBytes(g: LayerGroup): number {
  return g.layers.reduce((sum, id) => sum + (MODEL_FILES[id]?.bytes ?? 0), 0)
}

/** Whether a layer scope is shown for the current level mode (the section cut clips the rest). */
export function scopeVisible(scope: LayerScope, level: LevelMode): boolean {
  if (scope === 'upper') return level !== 'ground'
  return true
}

/** Accepted 16-station planning grid (from Accepted_16_Station_Footprints.glb). */
export const STATION_GRID = {
  x0: 5.918,
  z0: 2.964,
  cellX: 2.0, // along the hall
  cellZ: 2.5, // across the hall
  cols: 4,
  rows: 4,
  tableOffsetX: 0.606, // table center from the cell's −X edge
  chairOffsetX: 1.381, // chair center from the cell's −X edge
}
