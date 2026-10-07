// LoadingScreen/components/LoadingAnimationScene.tsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import useSpline from '@splinetool/r3f-spline';
import { PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { useControls, Leva } from 'leva';
import { type Mesh, Vector3, Color } from 'three';
import { type StreamState } from '../InfrastructureStreamManager';

interface SceneProps {
  statusSnapshot: StreamState;
  isExiting: boolean;
  onScreenMasked: () => void;
  [key: string]: any;
}

// Reusable vector constants to avoid frame-allocation garbage collection
const ZERO_VECTOR = new Vector3(0, 0, 0);
const TARGET_SCALE = new Vector3(1, 1, 1);
const EXIT_CUBE_START_SCALE = new Vector3(60, 60, 60); // Small size while spinning

export default function Scene({ statusSnapshot, isExiting, onScreenMasked, ...props }: SceneProps) {
  const { nodes, materials } = useSpline('https://prod.spline.design/sghG1VPRzVqp3B0U/scene.splinecode');
  
  const cubeRef = useRef<Mesh>(null);
  const helixRef = useRef<Mesh>(null);
  const torusRef = useRef<Mesh>(null);
  
  // Reference for the new dedicated exit cube
  const exitCubeRef = useRef<Mesh>(null);

  const progress = statusSnapshot?.progress ?? 0;
  const elapsedExitTime = useRef<number>(0);

  // 1. COMPREHENSIVE LEVA CONTROLS PANEL WITH COLOR PICKER
  const { exitCubeScaleValue, spinDuration, scaleDuration, freezeDuration, cubeColor } = useControls('Exit Control Timeline', {
    exitCubeScaleValue: {
      value: 490,
      min: 10,
      max: 600,
      step: 5,
      label: 'Target Scale Size'
    },
    spinDuration: {
      value: 3,
      min: 0.2,
      max: 4.0,
      step: 0.1,
      label: 'Phase 1: Spin Time (s)'
    },
    scaleDuration: {
      value: .5,
      min: 0.2,
      max: 4.0,
      step: 0.1,
      label: 'Phase 2: Scale Time (s)'
    },
    freezeDuration: {
      value: .5, 
      min: 0.0,
      max: 5.0,
      step: 0.1,
      label: 'Phase 3: Freeze Time (s)'
    },
    cubeColor: {
      value: '#ed8529',
      label: 'Cube Color'
    }
  });

  // Dynamically compute absolute time milestones based on the slider options
  const phase1End = spinDuration;
  const phase2End = spinDuration + scaleDuration;
  const totalExitTimeCutoff = spinDuration + scaleDuration + freezeDuration;

  // Dynamically update our target vector based on the slider value
  const exitCubeTargetScale = useMemo(() => {
    return new Vector3(exitCubeScaleValue, exitCubeScaleValue, exitCubeScaleValue);
  }, [exitCubeScaleValue]);

  // Color target instances optimized for frame execution loops
  const targetBackgroundColor = useMemo(() => new Color('#191f4a'), []);

  useFrame((_, delta) => {
    if (isExiting) {
      // DISMANTLE STAGE: Shrink the original loading shapes out of sight
      if (cubeRef.current) cubeRef.current.scale.lerp(ZERO_VECTOR, 0.15);
      if (helixRef.current) helixRef.current.scale.lerp(ZERO_VECTOR, 0.15);
      if (torusRef.current) torusRef.current.scale.lerp(ZERO_VECTOR, 0.15);

      // Advance our exit countdown timer
      elapsedExitTime.current += delta;

      // 2. TIMED EXIT CUBE TRANSITION (DYNAMICALLY MAPS TO LEVA TIMELINES)
      if (exitCubeRef.current) {
        const material = exitCubeRef.current.material as any;
        
        // PHASE 1: Spin while keeping the scale small
        if (elapsedExitTime.current <= phase1End) {
          exitCubeRef.current.scale.lerp(EXIT_CUBE_START_SCALE, 0.1);
          
          // Reset/keep the original color choice during the spin sequence
          if (material && material.color) {
            material.color.set(cubeColor);
          }
          
          // Exactly 1 full rotation (2 * Math.PI) across the dynamic spin time window
          const alpha = elapsedExitTime.current / phase1End;
          const totalTargetRotation = 2 * Math.PI; 
          
          exitCubeRef.current.rotation.y = alpha * totalTargetRotation;
          exitCubeRef.current.rotation.x = alpha * (totalTargetRotation * 0.5);
        } 
        
        // PHASE 2: Stop rotation, snap flat, and THEN scale up to target value
        else if (elapsedExitTime.current > phase1End && elapsedExitTime.current <= phase2End) {
          exitCubeRef.current.scale.lerp(exitCubeTargetScale, 0.1);
          
          // Round rotations to the nearest 90-degree increment to force a flat face orientation
          const targetY = Math.round(exitCubeRef.current.rotation.y / (Math.PI / 2)) * (Math.PI / 2);
          const targetX = Math.round(exitCubeRef.current.rotation.x / (Math.PI / 2)) * (Math.PI / 2);
          
          // Lock tightly onto the flat position
          exitCubeRef.current.rotation.y += (targetY - exitCubeRef.current.rotation.y) * 0.3;
          exitCubeRef.current.rotation.x += (targetX - exitCubeRef.current.rotation.x) * 0.3;
        } 
        
        // PHASE 3: Hold completely still and flat at full scale, then lerp color to #0D1026
        else {
          exitCubeRef.current.scale.copy(exitCubeTargetScale);
          
          const targetY = Math.round(exitCubeRef.current.rotation.y / (Math.PI / 2)) * (Math.PI / 2);
          const targetX = Math.round(exitCubeRef.current.rotation.x / (Math.PI / 2)) * (Math.PI / 2);
          
          exitCubeRef.current.rotation.y = targetY;
          exitCubeRef.current.rotation.x = targetX;

          // Smoothly morph color towards background color space during the freeze window
          if (material && material.color) {
            material.color.lerp(targetBackgroundColor, 0.1);
          }
        }
      }
      
      // Dynamic unmount threshold based on combined slider settings
      if (elapsedExitTime.current >= totalExitTimeCutoff) {
        onScreenMasked();
      }
    } else {
      // STANDARD LOADING SEQUENCE (Runs normally until isExiting becomes true)
      if (cubeRef.current) {
        if (progress >= 5) {
          cubeRef.current.scale.lerp(TARGET_SCALE, 0.1);
          cubeRef.current.rotation.y += delta * 0.8;
          cubeRef.current.rotation.x += delta * 0.4;
        } else {
          cubeRef.current.scale.set(0, 0, 0);
        }
      }

      if (helixRef.current) {
        if (progress >= 30) {
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
      <Leva hidden/>  
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
            position={[612, -49.51, 44.22]}
          />
          <mesh
            ref={cubeRef}
            name="Cube"
            geometry={nodes.Cube.geometry}
            material={materials['Cube Material']}
            castShadow
            receiveShadow
            position={[-673.21, -71.16, 52.99]}
          />
          <mesh
            ref={helixRef}
            name="Helix"
            geometry={nodes.Helix.geometry}
            material={materials['Helix Material']}
            castShadow
            receiveShadow
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
            {isExiting && (
              <mesh ref={exitCubeRef} position={[0, 0, -400]} scale={[0, 0, 0]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial 
                  color={cubeColor}
                />
              </mesh>
            )}
          </PerspectiveCamera>

          <directionalLight
            name="Directional Light"
            castShadow
            intensity={2.2}
            position={[200, 715.92, 832.85]}
          />
          <OrthographicCamera name="1" makeDefault={false} far={10000} near={-50000} />
          <hemisphereLight name="Default Ambient Light" intensity={2.36} color="#ebebeb" />
        </scene>
      </group>
    </>
  );
}
