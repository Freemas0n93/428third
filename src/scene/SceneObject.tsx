import { Edges, Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { CATALOG_BY_KEY } from '../data/catalog'
import { useScene, type PlacedObject } from '../store/scene'

interface Props {
  object: PlacedObject
  selected: boolean
}

/** A placed catalog item rendered as a dimensioned, labeled box. */
export default function SceneObject({ object, selected }: Props) {
  const select = useScene((s) => s.select)
  const item = CATALOG_BY_KEY[object.catalogKey]
  if (!item) return null

  const { w, d, h } = item
  // Seating labels add clutter in dense layouts; show them only when selected.
  const showLabel = selected || item.category !== 'seating'

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    select(object.id)
  }

  return (
    <group position={[object.x, object.y, object.z]} rotation={[0, object.rotY, 0]}>
      <mesh position={[0, h / 2, 0]} onClick={onClick}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={object.hex} roughness={0.8} metalness={0.05} />
        {selected && <Edges color="#ff5a1f" lineWidth={1.5} scale={1.01} />}
      </mesh>

      {/* Footprint outline on the floor for readability in plan view */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={selected ? '#ff5a1f' : '#000000'} transparent opacity={selected ? 0.35 : 0.25} />
      </mesh>

      {showLabel && (
        <Html position={[0, h + 0.25, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
          <div
            className={`pointer-events-none select-none whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium shadow ${
              selected ? 'bg-[#ff5a1f] text-black' : 'bg-black/70 text-white'
            }`}
          >
            {object.label}
          </div>
        </Html>
      )}
    </group>
  )
}
