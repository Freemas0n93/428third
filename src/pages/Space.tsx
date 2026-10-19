import { useState } from 'react'
import Viewer from '../scene/Viewer'
import { CATALOG, CATALOG_BY_KEY, CATEGORIES, CATEGORY_LABELS } from '../data/catalog'
import { LAYER_GROUPS, LEVELS, MODEL_LAYERS, UPPER_THRESHOLD_Y, groupBytes, scopeVisible, type LevelMode } from '../data/building'
import { useScene, type ViewPreset } from '../store/scene'
import { useModel } from '../store/model'

const VIEW_BUTTONS: Array<{ key: ViewPreset; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'plan', label: 'Plan' },
  { key: 'hall', label: 'Hall' },
  { key: 'mezzanine', label: 'Mezzanine' },
]

const LEVEL_BUTTONS: Array<{ key: LevelMode; label: string }> = [
  { key: 'ground', label: 'Ground' },
  { key: 'upper', label: 'Upper' },
  { key: 'all', label: 'All' },
]

const rad2deg = (r: number) => Math.round(((r * 180) / Math.PI) % 360)
const deg2rad = (d: number) => (d * Math.PI) / 180
const fmt = (n: number) => n.toFixed(2)
const mb = (b: number) => (b / 1e6).toFixed(1)

function segClass(active: boolean) {
  return `px-3 py-1.5 text-xs font-medium transition ${
    active ? 'bg-[var(--panel-2)] text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
  }`
}

/** Model load status: progress while fetching, then what is on screen. */
function ModelStatus() {
  const status = useModel((s) => s.status)
  const received = useModel((s) => s.received)
  const layers = useScene((s) => s.layers)
  const level = useScene((s) => s.level)

  const requested = MODEL_LAYERS.filter((l) => status[l.id])
  const loading = requested.filter((l) => status[l.id] === 'loading')
  const failed = requested.filter((l) => status[l.id] === 'error')
  const shownTris = MODEL_LAYERS.filter(
    (l) => status[l.id] === 'ready' && layers[l.group.key] && scopeVisible(l.group.scope, level),
  ).reduce((a, l) => a + l.tris, 0)

  let dot = 'bg-emerald-400'
  let text = `Scan model v33 · ${Math.round(shownTris / 1000)}k triangles shown`
  if (failed.length) {
    dot = 'bg-red-400'
    text = `${failed.length} layer${failed.length > 1 ? 's' : ''} failed to load — toggle to retry`
  } else if (loading.length || !requested.length) {
    const total = requested.reduce((a, l) => a + l.bytes, 0)
    const got = requested.reduce((a, l) => a + Math.min(received[l.id] ?? 0, l.bytes), 0)
    dot = 'bg-amber-400 animate-pulse'
    text = `Loading building… ${mb(got)} / ${mb(total)} MB`
  }
  return (
    <div data-testid="model-status" className="flex items-center gap-2 rounded-md bg-black/60 px-2 py-1 text-[11px] text-[var(--muted)]">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      {text}
    </div>
  )
}

function LayersPanel() {
  const layers = useScene((s) => s.layers)
  const setLayer = useScene((s) => s.setLayer)
  const showStationGrid = useScene((s) => s.showStationGrid)
  const setShowStationGrid = useScene((s) => s.setShowStationGrid)
  const [open, setOpen] = useState(false)

  return (
    <div className="pointer-events-auto w-[260px] rounded-lg border border-[var(--line)] bg-[var(--panel)]/90 backdrop-blur">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--text)]"
      >
        <span>Layers</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="space-y-1 border-t border-[var(--line)] px-3 py-2">
          {LAYER_GROUPS.map((g) => (
            <li key={g.key}>
              <label className="flex cursor-pointer items-start gap-2 text-xs" title={g.hint}>
                <input
                  type="checkbox"
                  checked={Boolean(layers[g.key])}
                  onChange={(e) => setLayer(g.key, e.target.checked)}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <span className="flex-1">
                  <span className="block">{g.label}</span>
                  <span className="block text-[10px] text-[var(--muted)]">{g.hint}</span>
                </span>
                <span className="font-mono text-[10px] text-[var(--muted)]">{mb(groupBytes(g))} MB</span>
              </label>
            </li>
          ))}
          <li className="border-t border-[var(--line)] pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showStationGrid}
                onChange={(e) => setShowStationGrid(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <span>Accepted 16-station grid</span>
            </label>
          </li>
        </ul>
      )}
    </div>
  )
}

export default function Space() {
  const view = useScene((s) => s.view)
  const setView = useScene((s) => s.setView)
  const objects = useScene((s) => s.objects)
  const selectedId = useScene((s) => s.selectedId)
  const level = useScene((s) => s.level)
  const setLevel = useScene((s) => s.setLevel)
  const cut = useScene((s) => s.cut)
  const setCut = useScene((s) => s.setCut)
  const updateObject = useScene((s) => s.updateObject)
  const removeObject = useScene((s) => s.removeObject)
  const duplicateObject = useScene((s) => s.duplicateObject)
  const addObject = useScene((s) => s.addObject)
  const [panelOpen, setPanelOpen] = useState(true)

  const selected = objects.find((o) => o.id === selectedId) ?? null
  const selectedItem = selected ? CATALOG_BY_KEY[selected.catalogKey] : null

  return (
    <div className="relative h-full w-full">
      <Viewer />

      {/* Top-left: view presets, level, layers, status */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-2">
        <div className="pointer-events-auto flex overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]/90 backdrop-blur">
          {VIEW_BUTTONS.map((b) => (
            <button key={b.key} onClick={() => setView(b.key)} className={segClass(view === b.key)}>
              {b.label}
            </button>
          ))}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]/90 backdrop-blur">
            {LEVEL_BUTTONS.map((b) => (
              <button key={b.key} onClick={() => setLevel(b.key)} className={segClass(level === b.key)}>
                {b.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCut(!cut)}
            disabled={level === 'all'}
            title={level === 'all' ? 'Pick a level to cut away the floors above it' : `Clip everything above ${LEVELS[level].cutY} m`}
            className={`rounded-lg border border-[var(--line)] bg-[var(--panel)]/90 px-3 py-1.5 text-xs font-medium backdrop-blur transition disabled:opacity-40 ${
              cut && level !== 'all' ? 'text-[var(--text)]' : 'text-[var(--muted)]'
            }`}
          >
            {cut && level !== 'all' ? '◧ Cut-away on' : '◧ Cut-away off'}
          </button>
        </div>
        <LayersPanel />
        <ModelStatus />
      </div>

      {/* Panel toggle (phone) */}
      <button
        onClick={() => setPanelOpen((v) => !v)}
        className="absolute right-3 top-3 z-20 rounded-md border border-[var(--line)] bg-[var(--panel)]/90 px-2 py-1 text-xs text-[var(--muted)] backdrop-blur md:hidden"
      >
        {panelOpen ? 'Hide' : 'Panel'}
      </button>

      {/* Right panel: selection + catalog */}
      <aside
        className={`absolute bottom-0 right-0 top-0 z-10 flex w-full max-w-[320px] flex-col border-l border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur transition-transform md:translate-x-0 ${
          panelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <section className="border-b border-[var(--line)] p-3">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Selection</h2>
          {selected && selectedItem ? (
            <div className="space-y-2 text-sm">
              <input
                value={selected.label}
                onChange={(e) => updateObject(selected.id, { label: e.target.value })}
                className="w-full rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-sm"
              />
              <div className="text-xs text-[var(--muted)]">
                {selectedItem.name} · {fmt(selectedItem.w)} × {fmt(selectedItem.d)} × {fmt(selectedItem.h)} m ·{' '}
                {selected.y >= UPPER_THRESHOLD_Y ? 'Upper' : 'Ground'} floor
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[var(--muted)]">X (m)</span>
                  <input
                    type="number"
                    step={0.1}
                    value={selected.x}
                    onChange={(e) => updateObject(selected.id, { x: Number(e.target.value) })}
                    className="rounded border border-[var(--line)] bg-[var(--bg)] px-1.5 py-1"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[var(--muted)]">Z (m)</span>
                  <input
                    type="number"
                    step={0.1}
                    value={selected.z}
                    onChange={(e) => updateObject(selected.id, { z: Number(e.target.value) })}
                    className="rounded border border-[var(--line)] bg-[var(--bg)] px-1.5 py-1"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[var(--muted)]">Rot (°)</span>
                  <input
                    type="number"
                    step={15}
                    value={rad2deg(selected.rotY)}
                    onChange={(e) => updateObject(selected.id, { rotY: deg2rad(Number(e.target.value)) })}
                    className="rounded border border-[var(--line)] bg-[var(--bg)] px-1.5 py-1"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <span className="text-[var(--muted)]">Color</span>
                <input
                  type="color"
                  value={selected.hex}
                  onChange={(e) => updateObject(selected.id, { hex: e.target.value })}
                  className="h-6 w-10 cursor-pointer rounded border border-[var(--line)] bg-transparent"
                />
                <span className="font-mono text-[11px] text-[var(--muted)]">{selected.hex}</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => duplicateObject(selected.id)}
                  className="rounded border border-[var(--line)] px-2 py-1 text-xs hover:bg-[var(--panel-2)]"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => removeObject(selected.id)}
                  className="rounded border border-[var(--line)] px-2 py-1 text-xs text-red-300 hover:bg-[var(--panel-2)]"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              Click an object to select it. New items drop on the level you are viewing. Drag-to-move and rotate
              handles arrive on Day 2.
            </p>
          )}
        </section>

        <section className="min-h-0 flex-1 overflow-y-auto p-3">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Catalog · {CATALOG.length} items
          </h2>
          {CATEGORIES.map((cat) => {
            const items = CATALOG.filter((c) => c.category === cat)
            if (!items.length) return null
            return (
              <div key={cat} className="mb-3">
                <div className="mb-1 text-[11px] font-medium text-[var(--muted)]">{CATEGORY_LABELS[cat]}</div>
                <ul className="space-y-0.5">
                  {items.map((c) => (
                    <li key={c.key}>
                      <button
                        onClick={() => addObject(c.key)}
                        className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-[var(--panel-2)]"
                      >
                        <span className="flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.hex }} />
                          {c.name}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--muted)]">
                          {c.w}×{c.d}×{c.h}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>

        <footer className="border-t border-[var(--line)] p-2 text-[10px] text-[var(--muted)]">
          {objects.length} objects · local only (sync arrives Day 3)
        </footer>
      </aside>
    </div>
  )
}
