import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import useSpline from '@splinetool/r3f-spline'
import { OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { type Mesh } from 'three'
import { type StreamState } from '../InfrastructureStreamManager'

interface SceneProps {
  statusSnapshot: StreamState;
  [key: string]: any; // Allows passing down the remaining fallback Canvas props (...props)
}

export default function Scene({ statusSnapshot, ...props }: SceneProps) {
  const { nodes, materials } = useSpline('https://prod.spline.design/sghG1VPRzVqp3B0U/scene.splinecode')
  
  // Strongly typed references matching Three.js Mesh instances
  const cubeRef = useRef<Mesh>(null)
  const helixRef = useRef<Mesh>(null)
  const torusRef = useRef<Mesh>(null)

  // Safely extract the progress percentage coming from your server
  const progress = statusSnapshot?.progress ?? 0
  useFrame((_, delta) => {
    // 1. Handle Cube (Reveals above 15% progress)
    if (cubeRef.current) {
      if (progress >= 15) {
        // Smoothly lerp (linear interpolate) scale from 0 towards 1
        cubeRef.current.scale.lerp({ x: 1, y: 1, z: 1 } as any, 0.1)
        // Spin the cube independently of the screen frame rate
        cubeRef.current.rotation.y += delta * 0.8
        cubeRef.current.rotation.x += delta * 0.4
      } else {
        cubeRef.current.scale.set(0, 0, 0)
      }
    }

    // 2. Handle Helix (Reveals above 45% progress)
    if (helixRef.current) {
      if (progress >= 45) {
        helixRef.current.scale.lerp({ x: 1, y: 1, z: 1 } as any, 0.1)
        helixRef.current.rotation.y -= delta * 1.2
      } else {
        helixRef.current.scale.set(0, 0, 0)
      }
    }

    // 3. Handle Torus Knot (Reveals above 75% progress)
    if (torusRef.current) {
      if (progress >= 75) {
        torusRef.current.scale.lerp({ x: 1, y: 1, z: 1 } as any, 0.1)
        torusRef.current.rotation.x += delta * 0.6
        torusRef.current.rotation.z += delta * 0.6
      } else {
        torusRef.current.scale.set(0, 0, 0)
      }
    }
  })
   return (
    <>
      <color attach="background" args={['#0D1026']} />
      <group {...props} dispose={null}>
        <scene name="Scene 1">
          <mesh
            ref={torusRef} // <-- Attached the Torus reference here
            name="Torus Knot"
            geometry={nodes['Torus Knot'].geometry}
            material={materials['Torus Knot Material']}
            castShadow
            receiveShadow
            morphTargetDictionary={nodes['Torus Knot'].morphTargetDictionary}
            morphTargetInfluences={nodes['Torus Knot'].morphTargetInfluences}
            position={[612, -49.51, 44.22]}
          />
          <mesh
            ref={cubeRef} // <-- Attached the Cube reference here
            name="Cube"
            geometry={nodes.Cube.geometry}
            material={materials['Cube Material']}
            castShadow
            receiveShadow
            morphTargetDictionary={nodes.Cube.morphTargetDictionary}
            morphTargetInfluences={nodes.Cube.morphTargetInfluences}
            position={[-673.21, -71.16, 52.99]}
          />
          <mesh
            ref={helixRef} // <-- Attached the Helix reference here
            name="Helix"
            geometry={nodes.Helix.geometry}
            material={materials['Helix Material']}
            castShadow
            receiveShadow
            morphTargetDictionary={nodes.Helix.morphTargetDictionary}
            morphTargetInfluences={nodes.Helix.morphTargetInfluences}
            position={[-4.52, -64.09, 70.68]}
          />
          <PerspectiveCamera
            name="Camera"
            makeDefault={true}
            far={100000}
            near={70}
            fov={45}
            up={[0, 1, 0]}
            position={[6.07, 230.36, 2147.87]}
            rotation={[-0.1, 0.04, 0]}
          />
          <directionalLight
            name="Directional Light"
            castShadow
            intensity={2.2}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-near={-10000}
            shadow-camera-far={100000}
            shadow-camera-left={-1000}
            shadow-camera-right={1000}
            shadow-camera-top={1000}
            shadow-camera-bottom={-1000}
            position={[200, 715.92, 832.85]}
          />
          <OrthographicCamera name="1" makeDefault={false} far={10000} near={-50000} />
          <hemisphereLight name="Default Ambient Light" intensity={2.36} color="#ebebeb" />
        </scene>
      </group>
    </>
  )
}