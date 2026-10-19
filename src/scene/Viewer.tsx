import { Suspense, useEffect, useRef, type ComponentRef, type RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import PlaceholderRoom from './PlaceholderRoom'
import SceneObject from './SceneObject'
import { PLACEHOLDER_ROOM, useScene, type ViewPreset } from '../store/scene'

type OrbitRef = ComponentRef<typeof OrbitControls>

interface CameraPose {
  position: [number, number, number]
  target: [number, number, number]
}

const VIEWS: Record<ViewPreset, CameraPose> = {
  overview: { position: [14, 12, 18], target: [0, 0.8, 0] },
  plan: { position: [0, 32, 0.001], target: [0, 0, 0] },
  entrance: {
    position: [0, 1.6, PLACEHOLDER_ROOM.depth / 2 + 6],
    target: [0, 1.4, 0],
  },
}

function CameraRig({ view, controls }: { view: ViewPreset; controls: RefObject<OrbitRef | null> }) {
  const camera = useThree((s) => s.camera)
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
  }, [view, camera, controls])
  return null
}

function SceneContent() {
  const objects = useScene((s) => s.objects)
  const selectedId = useScene((s) => s.selectedId)
  const view = useScene((s) => s.view)
  const controls = useRef<OrbitRef>(null)
  const plan = view === 'plan'

  return (
    <>
      <color attach="background" args={['#0b0d10']} />
      <fog attach="fog" args={['#0b0d10', 40, 90]} />

      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#dfe7f0', '#2a2d33', 0.5]} />
      <directionalLight position={[10, 16, 8]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} />

      <Grid
        position={[0, -0.002, 0]}
        args={[80, 80]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#2a3038"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#3a424d"
        fadeDistance={60}
        fadeStrength={1.5}
        infiniteGrid
      />

      <PlaceholderRoom />

      {objects.map((o) => (
        <SceneObject key={o.id} object={o} selected={o.id === selectedId} />
      ))}

      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enableRotate={!plan}
        minDistance={2}
        maxDistance={70}
        maxPolarAngle={plan ? 0 : Math.PI / 2 - 0.03}
        minPolarAngle={0}
        screenSpacePanning={plan}
      />
      <CameraRig view={view} controls={controls} />
    </>
  )
}

export default function Viewer() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: VIEWS.overview.position, fov: 45, near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      className="h-full w-full"
    >
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  )
}
