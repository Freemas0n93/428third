import { useMemo } from 'react'
import * as THREE from 'three'
import { STATION_GRID as G } from '../data/building'

/** Floor annotation for the accepted 16-station grid (8.0 × 10.0 m, 2.0 × 2.5 m cells). */
export default function StationGrid() {
  const geometry = useMemo(() => {
    const y = 0.03
    const x1 = G.x0 + G.cols * G.cellX
    const z1 = G.z0 + G.rows * G.cellZ
    const pts: number[] = []
    for (let c = 0; c <= G.cols; c++) {
      const x = G.x0 + c * G.cellX
      pts.push(x, y, G.z0, x, y, z1)
    }
    for (let r = 0; r <= G.rows; r++) {
      const z = G.z0 + r * G.cellZ
      pts.push(G.x0, y, z, x1, y, z)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#3b6fd6" transparent opacity={0.85} depthWrite={false} />
    </lineSegments>
  )
}
