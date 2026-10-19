/**
 * Object catalog for the showroom.
 * Dimensions are in meters: w = width (x), d = depth (z), h = height (y).
 * Day 0–2: every item renders as a dimensioned, labeled box.
 * v1.1: items gain an optional `modelUrl` (GLB) and the box becomes the fallback.
 */

export type CatalogCategory =
  | 'workstations'
  | 'seating'
  | 'lounge'
  | 'bar'
  | 'robotics'
  | 'av'
  | 'storage'
  | 'decor'
  | 'logistics'

export interface CatalogItem {
  key: string
  name: string
  category: CatalogCategory
  w: number
  d: number
  h: number
  hex: string
  modelUrl?: string
}

export const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  workstations: 'Workstations',
  seating: 'Seating',
  lounge: 'Lounge',
  bar: 'Bar & catering',
  robotics: 'Robotics',
  av: 'AV & display',
  storage: 'Storage',
  decor: 'Decor',
  logistics: 'Logistics',
}

const CATEGORY_HEX: Record<CatalogCategory, string> = {
  workstations: '#c9a66b',
  seating: '#7f8c8d',
  lounge: '#8e6c88',
  bar: '#3f6e8c',
  robotics: '#ff5a1f',
  av: '#2f2f33',
  storage: '#6b7b5e',
  decor: '#4f8a5b',
  logistics: '#a0522d',
}

function item(
  key: string,
  name: string,
  category: CatalogCategory,
  w: number,
  d: number,
  h: number,
  hex?: string,
): CatalogItem {
  return { key, name, category, w, d, h, hex: hex ?? CATEGORY_HEX[category] }
}

export const CATALOG: CatalogItem[] = [
  // Workstations
  item('desk-1600', 'Desk 1600', 'workstations', 1.6, 0.8, 0.75),
  item('desk-1200', 'Desk 1200', 'workstations', 1.2, 0.6, 0.75),
  item('workbench', 'Workbench', 'workstations', 1.8, 0.9, 0.9),
  item('reception-desk', 'Reception desk', 'workstations', 2.0, 0.8, 1.1),
  item('conf-table-8', 'Conference table (8)', 'workstations', 2.4, 1.2, 0.75),

  // Seating
  item('task-chair', 'Task chair', 'seating', 0.65, 0.65, 1.0),
  item('bar-stool', 'Bar stool', 'seating', 0.45, 0.45, 0.75),

  // Lounge
  item('sofa-3', 'Sofa, 3-seat', 'lounge', 2.2, 0.9, 0.8),
  item('lounge-chair', 'Lounge chair', 'lounge', 0.85, 0.85, 0.75),
  item('coffee-table', 'Coffee table', 'lounge', 1.2, 0.6, 0.4),

  // Bar & catering
  item('bar-3m', 'Bar / counter 3 m', 'bar', 3.0, 0.7, 1.05),
  item('back-bar', 'Back bar shelving', 'bar', 2.0, 0.5, 2.0),
  item('hi-top', 'Hi-top table', 'bar', 0.7, 0.7, 1.05),

  // Robotics
  item('robot-cell', 'Robot demo cell (fenced)', 'robotics', 3.0, 3.0, 2.2),
  item('robot-pedestal', 'Robot arm on pedestal', 'robotics', 0.8, 0.8, 1.6),
  item('humanoid-stand', 'Humanoid robot stand', 'robotics', 0.8, 0.8, 1.8),
  item('mobile-robot', 'Mobile robot (AMR)', 'robotics', 0.9, 0.6, 0.4),
  item('display-plinth', 'Display plinth', 'robotics', 0.6, 0.6, 1.0, '#d9d4c7'),

  // AV & display
  item('display-75', '75" display on stand', 'av', 1.7, 0.6, 1.9),
  item('projector-screen', 'Projector screen', 'av', 3.0, 0.1, 2.0),
  item('speaker', 'PA speaker on stand', 'av', 0.4, 0.4, 1.8),

  // Storage
  item('cabinet', 'Storage cabinet', 'storage', 1.0, 0.5, 1.8),
  item('shelving', 'Wire shelving unit', 'storage', 1.2, 0.6, 1.8),

  // Decor
  item('planter-l', 'Planter, large', 'decor', 0.6, 0.6, 1.4),
  item('stanchion', 'Stanchion', 'decor', 0.35, 0.35, 1.0),
  item('rug-3x2', 'Rug 3 × 2 m', 'decor', 3.0, 2.0, 0.02, '#b89b7a'),

  // Logistics
  item('pallet', 'Pallet / crate', 'logistics', 1.2, 1.0, 1.0),
  item('rolling-rack', 'Rolling rack', 'logistics', 1.2, 0.6, 1.7),
]

export const CATALOG_BY_KEY: Record<string, CatalogItem> = Object.fromEntries(
  CATALOG.map((c) => [c.key, c]),
)

export const CATEGORIES: CatalogCategory[] = [
  'workstations',
  'seating',
  'lounge',
  'bar',
  'robotics',
  'av',
  'storage',
  'decor',
  'logistics',
]
