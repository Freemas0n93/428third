import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { BASIS_PATH, LEVELS, MODEL_LAYERS, scopeVisible, type ModelLayer } from '../data/building'
import { useScene } from '../store/scene'
import { useModel } from '../store/model'

/*
 * Building model: one GLB per layer (meshopt geometry + KTX2/Basis textures), loaded on demand.
 * Layers are fetched the first time they are switched on and then kept in memory, so toggling
 * is instant. A single loader is shared because the KTX2 transcoder runs in worker threads.
 */

let gltfLoader: GLTFLoader | null = null
function getLoader(gl: THREE.WebGLRenderer): GLTFLoader {
  if (!gltfLoader) {
    const ktx2 = new KTX2Loader().setTranscoderPath(BASIS_PATH).detectSupport(gl)
    gltfLoader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder)
  }
  return gltfLoader
}

const cache = new Map<string, Promise<THREE.Group>>()

function loadLayer(layer: ModelLayer, gl: THREE.WebGLRenderer): Promise<THREE.Group> {
  const hit = cache.get(layer.id)
  if (hit) return hit
  const { setStatus, setReceived } = useModel.getState()
  setStatus(layer.id, 'loading')
  const p = getLoader(gl)
    .loadAsync(layer.url, (e) => setReceived(layer.id, e.loaded))
    .then((gltf) => {
      const root = gltf.scene
      root.name = `layer-${layer.id}`
      // Static geometry: compute matrices once instead of every frame.
      root.traverse((o) => {
        o.updateMatrix()
        o.matrixAutoUpdate = false
      })
      root.updateMatrixWorld(true)
      setReceived(layer.id, layer.bytes)
      setStatus(layer.id, 'ready')
      return root
    })
    .catch((err: unknown) => {
      console.error(`[building] layer ${layer.id} failed to load`, err)
      setStatus(layer.id, 'error')
      cache.delete(layer.id) // allow a retry on the next toggle
      throw err
    })
  cache.set(layer.id, p)
  return p
}

function Layer({ layer, visible }: { layer: ModelLayer; visible: boolean }) {
  const gl = useThree((s) => s.gl)
  const [root, setRoot] = useState<THREE.Group | null>(null)

  useEffect(() => {
    let alive = true
    loadLayer(layer, gl).then(
      (g) => alive && setRoot(g),
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [layer, gl])

  if (!root) return null
  return <primitive object={root} visible={visible} />
}

/** Clips everything above the current level's cut height (renderer-wide clipping plane). */
function SectionCut() {
  const gl = useThree((s) => s.gl)
  const level = useScene((s) => s.level)
  const cut = useScene((s) => s.cut)

  useEffect(() => {
    gl.clippingPlanes =
      level !== 'all' && cut ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), LEVELS[level].cutY)] : []
    return () => {
      gl.clippingPlanes = []
    }
  }, [gl, level, cut])
  return null
}

export default function Building() {
  const layers = useScene((s) => s.layers)
  const level = useScene((s) => s.level)
  const status = useModel((s) => s.status)

  // Once everything requested so far is in, prefetch the other default layers (e.g. the upper
  // floor while viewing Ground) so switching levels doesn't wait on the network.
  const requested = Object.values(status)
  const idle = requested.length > 0 && requested.every((s) => s !== 'loading')

  return (
    <group name="building">
      <SectionCut />
      {MODEL_LAYERS.map((l) => {
        const on = Boolean(layers[l.group.key])
        const visible = on && scopeVisible(l.group.scope, level)
        // Mount once requested; afterwards keep it mounted (hidden) so re-enabling is instant.
        const prefetch = idle && on && l.group.defaultOn
        if (!visible && !status[l.id] && !prefetch) return null
        return <Layer key={l.id} layer={l} visible={visible} />
      })}
    </group>
  )
}
