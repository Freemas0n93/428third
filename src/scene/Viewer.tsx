import { Suspense, useEffect, useRef, type ComponentRef, type RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import Building from './Building'
import SceneObject from './SceneObject'
import StationGrid from './StationGrid'
import DebugStats from './DebugStats'
import { SITE_DIMS, UPPER_THRESHOLD_Y } from '../data/building'
import { useScene, type ViewPreset } from '../store/scene'

type OrbitRef = ComponentRef<typeof OrbitControls>

const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')

interface CameraPose {
  position: [number, number, number]
  target: [number, number, number]
}

const C = SITE_DIMS.center

/**
 * Camera presets in the building frame (origin = datum A, +X down the hall, +Z toward the brick wall).
 * Overview and Plan aim ~8 m right of the building's center so it sits in the area left of the
 * 320 px side panel on desktop.
 */
const VIEWS: Record<ViewPreset, CameraPose> = {
  overview: { position: [-12.5, 25, -9.5], target: [17.5, 0, 15] },
  plan: { position: [C.x + 6.5, 56, C.z + 0.001], target: [C.x + 6.5, 0, C.z] },
  hall: { position: [1.2, 1.7, 6.5], target: [30, 1.8, 6.5] },
  mezzanine: { position: [36, 4.4, 15.5], target: [25, 3.4, 19] },
}

function CameraRig({ controls }: { controls: RefObject<OrbitRef | null> }) {
  const camera = useThree((s) => s.camera)
  const view = useScene((s) => s.view)
  const nonce = useScene((s) => s.viewNonce)
  useEffect(() => {
    const pose = VIEWS[view]
    camera.position.set(...pose.position)
    const c = controls.current
    if (c) {
      c.target.set(...pose.target)
      c.update()
    } else {
      camera.lookAt(...pose.target)
    }
  }, [view, nonce, camera, controls])
  return null
}

function SceneContent() {
  const objects = useScene((s) => s.objects)
  const selectedId = useScene((s) => s.selectedId)
  const view = useScene((s) => s.view)
  const level = useScene((s) => s.level)
  const showStationGrid = useScene((s) => s.showStationGrid)
  const controls = useRef<OrbitRef>(null)
  const plan = view === 'plan'

  const shown = level === 'ground' ? objects.filter((o) => o.y < UPPER_THRESHOLD_Y) : objects

  return (
    <>
      <color attach="background" args={['#0b0d10']} />

      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#eef2f6', '#3a3d42', 0.6]} />
      <directionalLight position={[10, 30, -8]} intensity={1.2} />

      <Grid
        position={[C.x, -0.05, C.z]}
        args={[120, 120]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#2a3038"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#3a424d"
        fadeDistance={140}
        fadeStrength={1.5}
        infiniteGrid
      />

      <Building />
      {showStationGrid && <StationGrid />}

      {shown.map((o) => (
        <SceneObject key={o.id} object={o} selected={o.id === selectedId} />
      ))}

      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enableRotate={!plan}
        minDistance={0.5}
        maxDistance={150}
        maxPolarAngle={plan ? 0 : Math.PI / 2 - 0.03}
        minPolarAngle={0}
        screenSpacePanning={plan}
      />
      <CameraRig controls={controls} />
      {DEBUG && <DebugStats />}
    </>
  )
}

export default function Viewer() {
  const select = useScene((s) => s.select)
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      camera={{ position: VIEWS.overview.position, fov: 45, near: 0.1, far: 400 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => select(null)}
      className="h-full w-full"
    >
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  )
}
