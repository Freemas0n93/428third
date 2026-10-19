import { PLACEHOLDER_ROOM as R, useScene } from '../store/scene'

const WALL = '#2a3038'
const FLOOR = '#1a1f26'
const GLASS = '#7fb3d5'

/**
 * Stand-in building envelope: floor slab, three solid walls, and a street-facing
 * wall with a storefront opening. Replaced by the calibrated scan on Day 1.
 */
export default function PlaceholderRoom() {
  const select = useScene((s) => s.select)
  const { width: w, depth: d, height: h, wallThickness: t, storefrontWidth: sf } = R
  const sideW = (w - sf) / 2

  return (
    <group>
      {/* Floor slab — clicking empty floor clears selection */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation()
          select(null)
        }}
      >
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={FLOOR} roughness={0.95} />
      </mesh>

      {/* Back wall (−Z) */}
      <mesh position={[0, h / 2, -d / 2 - t / 2]}>
        <boxGeometry args={[w + 2 * t, h, t]} />
        <meshStandardMaterial color={WALL} />
      </mesh>

      {/* Side walls (±X) */}
      <mesh position={[-w / 2 - t / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial color={WALL} />
      </mesh>
      <mesh position={[w / 2 + t / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial color={WALL} />
      </mesh>

      {/* Street wall (+Z): two solid piers + storefront glazing + header */}
      <mesh position={[-w / 2 + sideW / 2, h / 2, d / 2 + t / 2]}>
        <boxGeometry args={[sideW, h, t]} />
        <meshStandardMaterial color={WALL} />
      </mesh>
      <mesh position={[w / 2 - sideW / 2, h / 2, d / 2 + t / 2]}>
        <boxGeometry args={[sideW, h, t]} />
        <meshStandardMaterial color={WALL} />
      </mesh>
      <mesh position={[0, h - 0.3, d / 2 + t / 2]}>
        <boxGeometry args={[sf, 0.6, t]} />
        <meshStandardMaterial color={WALL} />
      </mesh>
      <mesh position={[0, (h - 0.6) / 2, d / 2 + t / 2]}>
        <boxGeometry args={[sf, h - 0.6, 0.04]} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.25} roughness={0.1} />
      </mesh>
    </group>
  )
}
