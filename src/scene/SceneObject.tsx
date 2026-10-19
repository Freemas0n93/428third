import { memo, useRef } from 'react'
import * as THREE from 'three'
import { Edges, Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { CATALOG_BY_KEY } from '../data/catalog'
import { useScene, type PlacedObject } from '../store/scene'

interface Props {
  object: PlacedObject
  selected: boolean
}

/** Pointer travel on the floor plane (m) before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 0.015

interface DragState {
  plane: THREE.Plane
  start: THREE.Vector3
  hit: THREE.Vector3
  /** Footprint center minus the first hit point, so the object doesn't jump to the cursor. */
  offset: { x: number; z: number }
  moved: boolean
}

function setCursor(c: string) {
  document.body.style.cursor = c
}

/**
 * A placed catalog item rendered as a dimensioned, labeled box.
 *
 * Press-and-drag moves it on the plane of the floor it stands on (y = object.y); the pointer
 * is captured so the drag survives leaving the box. Orbit controls pause for the duration via
 * `draggingId`. Locked objects select but never move.
 */
function SceneObjectImpl({ object, selected }: Props) {
  const select = useScene((s) => s.select)
  const moveObject = useScene((s) => s.moveObject)
  const setDragging = useScene((s) => s.setDragging)
  const drag = useRef<DragState | null>(null)
  const hovered = useRef(false)

  const item = CATALOG_BY_KEY[object.catalogKey]
  if (!item) return null

  const { w, d, h } = item
  // Seating labels add clutter in dense layouts; show them only when selected.
  const showLabel = selected || item.category !== 'seating'

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    select(object.id)
    if (object.locked) return
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -object.y)
    const hit = new THREE.Vector3()
    if (!e.ray.intersectPlane(plane, hit)) return
    drag.current = {
      plane,
      start: hit.clone(),
      hit,
      offset: { x: object.x - hit.x, z: object.z - hit.z },
      moved: false,
    }
    // Pause orbit immediately so the camera doesn't twitch before the drag threshold is crossed.
    setDragging(object.id)
    ;(e.target as Element | null)?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const s = drag.current
    if (!s) return
    e.stopPropagation()
    if (!e.ray.intersectPlane(s.plane, s.hit)) return
    if (!s.moved) {
      if (s.hit.distanceTo(s.start) < DRAG_THRESHOLD) return
      s.moved = true
      setCursor('grabbing')
    }
    moveObject(object.id, s.hit.x + s.offset.x, s.hit.z + s.offset.z)
  }

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    const s = drag.current
    if (!s) return
    e.stopPropagation()
    drag.current = null
    ;(e.target as Element | null)?.releasePointerCapture(e.pointerId)
    setDragging(null)
    setCursor(hovered.current ? 'grab' : '')
  }

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    hovered.current = true
    if (!drag.current) setCursor(object.locked ? 'default' : 'grab')
  }

  const onPointerOut = () => {
    hovered.current = false
    if (!drag.current) setCursor('')
  }

  const outline = selected ? '#ff5a1f' : object.locked ? '#8b949e' : '#000000'

  return (
    <group position={[object.x, object.y, object.z]} rotation={[0, object.rotY, 0]}>
      <mesh
        position={[0, h / 2, 0]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={object.hex} roughness={0.8} metalness={0.05} />
        {selected && <Edges color="#ff5a1f" lineWidth={1.5} scale={1.01} />}
      </mesh>

      {/* Footprint outline on the floor for readability in plan view */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={outline} transparent opacity={selected ? 0.35 : 0.25} />
      </mesh>

      {/* pointerEvents goes on the wrapper, not just the child: in Plan view the label sits exactly
          over the box's center and would otherwise intercept the press meant for the object. */}
      {showLabel && (
        <Html
          position={[0, h + 0.25, 0]}
          center
          distanceFactor={14}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={`select-none whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium shadow ${
              selected ? 'bg-[#ff5a1f] text-black' : 'bg-black/70 text-white'
            }`}
          >
            {object.locked && <span className="mr-1 opacity-70">🔒</span>}
            {object.label}
          </div>
        </Html>
      )}
    </group>
  )
}

/** Memoized so dragging one object doesn't re-render the other hundred. */
const SceneObject = memo(SceneObjectImpl)
export default SceneObject
