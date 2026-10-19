import { useFrame, useThree } from '@react-three/fiber'

declare global {
  interface Window {
    __428?: { triangles: number; calls: number; textures: number; geometries: number; frames: number }
  }
}

/**
 * Exposes renderer stats on window.__428 when the URL has ?debug — used by the CI smoke test
 * (scripts/smoke.mjs) to confirm the building actually renders. Mounted only in debug mode.
 */
export default function DebugStats() {
  const gl = useThree((s) => s.gl)
  useFrame(() => {
    const prev = window.__428
    window.__428 = {
      triangles: gl.info.render.triangles,
      calls: gl.info.render.calls,
      textures: gl.info.memory.textures,
      geometries: gl.info.memory.geometries,
      frames: (prev?.frames ?? 0) + 1,
    }
  })
  return null
}
