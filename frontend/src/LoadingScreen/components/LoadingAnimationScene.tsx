// LoadingScreen/components/LoadingAnimationScene.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import useSpline from '@splinetool/r3f-spline';
import { PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { type Mesh, Vector3 } from 'three';
import { type StreamState } from '../InfrastructureStreamManager';

interface SceneProps {
  statusSnapshot: StreamState;
  isExiting: boolean;
  onScreenMasked: () => void;
  [key: string]: any;
}

// Reusable zero vector constant to avoid frame-allocation garbage collection
const ZERO_VECTOR = new Vector3(0, 0, 0);
const TARGET_SCALE = new Vector3(1, 1, 1);

export default function Scene({ statusSnapshot, isExiting, onScreenMasked, ...props }: SceneProps) {
  const { nodes, materials } = useSpline('https://prod.spline.design/sghG1VPRzVqp3B0U/scene.splinecode');
  
  const cubeRef = useRef<Mesh>(null);
  const helixRef = useRef<Mesh>(null);
  const torusRef = useRef<Mesh>(null);
  
  // Dedicated reference for our standalone transition mesh cover
  const blanketRef = useRef<Mesh>(null);

  const progress = statusSnapshot?.progress ?? 0;
  const elapsedExitTime = useRef<number>(0);

  useFrame((_, delta) => {
    // 1. ORIGINAL SCENE LIFECYCLE + EXIT STRUCTURING
    if (isExiting) {
      // PHASE A: Handle Asset Dismantling / Freezing during exit
      if (cubeRef.current) cubeRef.current.scale.lerp(ZERO_VECTOR, 0.15);
      if (helixRef.current) helixRef.current.scale.lerp(ZERO_VECTOR, 0.15);
      if (torusRef.current) torusRef.current.scale.lerp(ZERO_VECTOR, 0.15);

      // PHASE B: Transition the blanket visibility smoothly to completely seal the frame
      if (blanketRef.current) {
        // Smoothly scale the blanket up to block out anything remaining
        blanketRef.current.scale.lerp(new Vector3(500, 500, 1), 0.2);
      }

      // 2. TIMING RETENTION COUNTER
      elapsedExitTime.current += delta;
      
      // Deliberately hold the blank viewport state for exactly 2 seconds
      if (elapsedExitTime.current >= 2.0) {
        onScreenMasked();
      }
    } else {
      // Standard Progress Loading Sequences (Active only while loading)
      if (cubeRef.current) {
        if (progress >= 15) {
          cubeRef.current.scale.lerp(TARGET_SCALE, 0.1);
          cubeRef.current.rotation.y += delta * 0.8;
          cubeRef.current.rotation.x += delta * 0.4;
        } else {
          cubeRef.current.scale.set(0, 0, 0);
        }
      }

      if (helixRef.current) {
        if (progress >= 45) {
          helixRef.current.scale.lerp(TARGET_SCALE, 0.1);
          helixRef.current.rotation.y -= delta * 1.2;
        } else {
          helixRef.current.scale.set(0, 0, 0);
        }
      }

      if (torusRef.current) {
        if (progress >= 75) {
          torusRef.current.scale.lerp(TARGET_SCALE, 0.1);
          torusRef.current.rotation.x += delta * 0.6;
          torusRef.current.rotation.z += delta * 0.6;
        } else {
          torusRef.current.scale.set(0, 0, 0);
        }
      }
    }
  });

  return (
    <>
      <color attach="background" args={['#0D1026']} />
      <group {...props} dispose={null}>
        <scene name="Scene 1">
          <mesh
            ref={torusRef}
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
            ref={cubeRef}
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
            ref={helixRef}
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
          >
            {/* 
              PROVEN NESTED BLANKET COVER:
              Starts at scale [0,0,0] and expands smoothly to avoid clipping artifact leaks.
            */}
            {isExiting && (
              <mesh ref={blanketRef} position={[0, 0, -100]} scale={[0, 0, 0]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#0D1026" depthWrite={false} transparent />
              </mesh>
            )}
          </PerspectiveCamera>

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
  );
}
