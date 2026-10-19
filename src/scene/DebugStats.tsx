import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useScene } from '../store/scene'

interface DebugApi {
  triangles: number
  calls: number
  textures: number
  geometries: number
  frames: number
  /** The scene store (getState / setState / subscribe), for driving the app from a test. */
  scene: typeof useScene
  /** World point → CSS pixel position on the page, for synthesizing pointer input in a test. */
  project: (x: number, y: number, z: number) => { x: number; y: number }
}

declare global {
  interface Window {
    __428?: Partial<DebugApi>
  }
}

/**
 * Exposes renderer stats and a small test API on window.__428 when the URL has ?debug — used by
 * the CI smoke test (scripts/smoke.mjs) to confirm the building renders and objects can be
 * dragged. Mounted only in debug mode.
 */
export default function DebugStats() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    const v = new THREE.Vector3()
    const project = (x: number, y: number, z: number) => {
      v.set(x, y, z).project(camera)
      const r = gl.domElement.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    }
    window.__428 = { ...window.__428, scene: useScene, project }
  }, [gl, camera])

  useFrame(() => {
    const prev = window.__428
    window.__428 = {
      ...prev,
      triangles: gl.info.render.triangles,
      calls: gl.info.render.calls,
      textures: gl.info.memory.textures,
      geometries: gl.info.memory.geometries,
      frames: (prev?.frames ?? 0) + 1,
    }
  })
  return null
}
