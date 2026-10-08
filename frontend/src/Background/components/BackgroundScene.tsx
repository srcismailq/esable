// src/Background/components/BackgroundScene.tsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import useSpline from '@splinetool/r3f-spline';
import { PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { useControls, Leva } from 'leva';
import { type Mesh, Color } from 'three';
import { type StreamState } from '../../LoadingScreen/InfrastructureStreamManager';
import { InfraBootAnimator } from '../animators/InfraBootAnimator';
import { DashboardIdleAnimator } from '../animators/DashboardIdleAnimator';
import InfraLoaderVisuals from './InfraLoaderVisuals';
import DashboardVisuals from './DashboardVisuals';

interface BackgroundSceneProps {
  statusSnapshot: StreamState;
  isExiting: boolean;
  onScreenMasked: () => void;
  isAppReady: boolean;
  isProcessing: boolean;
  [key: string]: any;
}

export default function BackgroundScene({ 
  statusSnapshot, 
  isExiting, 
  onScreenMasked, 
  isAppReady, 
  isProcessing, 
  ...props 
}: BackgroundSceneProps) {
  const { nodes, materials } = useSpline('https://prod.spline.design/sghG1VPRzVqp3B0U/scene.splinecode');
  const progress = statusSnapshot?.progress ?? 0;

  // Local instance mesh handles passed safely down to presentation layers
  const loaderCubeRef = useRef<Mesh>(null);
  const loaderHelixRef = useRef<Mesh>(null);
  const loaderTorusRef = useRef<Mesh>(null);
  const centerCubeRef = useRef<Mesh>(null);

  const { exitCubeScaleValue, spinDuration, scaleDuration, freezeDuration, cubeColor } = useControls('Exit Control Timeline', {
    exitCubeScaleValue: { value: 490, min: 10, max: 600, step: 5, label: 'Target Scale Size' },
    spinDuration: { value: 3, min: 0.2, max: 4.0, step: 0.1, label: 'Phase 1: Spin Time (s)' },
    scaleDuration: { value: .5, min: 0.2, max: 4.0, step: 0.1, label: 'Phase 2: Scale Time (s)' },
    freezeDuration: { value: .5, min: 0.0, max: 5.0, step: 0.1, label: 'Phase 3: Freeze Time (s)' },
    cubeColor: { value: '#ed8529', label: 'Cube Color' }
  });

  const bootAnimator = useMemo(() => {
    return new InfraBootAnimator({ exitCubeScaleValue});
  }, [exitCubeScaleValue, spinDuration, scaleDuration, freezeDuration]);

  const dashboardAnimator = useMemo(() => {
    return new DashboardIdleAnimator();
  }, []);

  const originalColor = useMemo(() => new Color(cubeColor), [cubeColor]);
  const targetBackgroundColor = useMemo(() => new Color('#191f4a'), []);

  useFrame((_, delta) => {
    // --- MODE 1: INFRASTRUCTURE LOADING LIFE-STAGE ---
    if (!isAppReady) {
      const snapshot = bootAnimator.step(delta, isExiting, progress);

      // Mutate live meshes directly using frame vectors
      if (loaderCubeRef.current) loaderCubeRef.current.scale.fromArray(snapshot.cubeScale);
      if (loaderHelixRef.current) loaderHelixRef.current.scale.fromArray(snapshot.helixScale);
      if (loaderTorusRef.current) loaderTorusRef.current.scale.fromArray(snapshot.torusScale);

      if (!isExiting) {
        if (loaderCubeRef.current && progress >= 5) {
          loaderCubeRef.current.rotation.y += delta * 0.8;
          loaderCubeRef.current.rotation.x += delta * 0.4;
        }
        if (loaderHelixRef.current && progress >= 30) {
          loaderHelixRef.current.rotation.y -= delta * 1.2;
        }
        if (loaderTorusRef.current && progress >= 75) {
          loaderTorusRef.current.rotation.x += delta * 0.6;
          loaderTorusRef.current.rotation.z += delta * 0.6;
        }
      }

      if (centerCubeRef.current) {
        centerCubeRef.current.scale.fromArray(snapshot.exitCubeScale);
        centerCubeRef.current.rotation.fromArray(snapshot.exitCubeRotation);

        const material = centerCubeRef.current.material as any;
        if (material && material.color) {
          material.color.copy(originalColor).lerp(targetBackgroundColor, snapshot.colorMorphedAlpha);
        }
      }

      if (snapshot.isTimelineComplete) {
        onScreenMasked();
      }
    } 
    // --- MODE 2: PERSISTENT DASHBOARD BACKGROUND LIFE-STAGE ---
    else {
      const snapshot = dashboardAnimator.step(delta, isProcessing);

      // Force-contract loading structures out of sight
      if (loaderCubeRef.current) loaderCubeRef.current.scale.set(0, 0, 0);
      if (loaderHelixRef.current) loaderHelixRef.current.scale.set(0, 0, 0);
      if (loaderTorusRef.current) loaderTorusRef.current.scale.set(0, 0, 0);

      // Seamlessly map ambient data directly onto the live center cube mesh
      if (centerCubeRef.current) {
        centerCubeRef.current.scale.fromArray(snapshot.centerCubeScale);
        centerCubeRef.current.rotation.fromArray(snapshot.centerCubeRotation);

        const material = centerCubeRef.current.material as any;
        if (material && material.color) {
          material.color.copy(originalColor); // Reset color to full vibrancy
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
          
          <InfraLoaderVisuals 
            nodes={nodes} 
            materials={materials}
            cubeRef={loaderCubeRef}
            helixRef={loaderHelixRef}
            torusRef={loaderTorusRef}
          />

          <PerspectiveCamera name="Camera" makeDefault far={100000} near={70} fov={45} position={[6.07, 230.36, 2147.87]} rotation={[-0.1, 0.04, 0]}>
            <DashboardVisuals 
              centerCubeRef={centerCubeRef}
              cubeColor={cubeColor}
            />
          </PerspectiveCamera>

          <directionalLight name="Directional Light" castShadow intensity={2.2} position={[200, 715.92, 832.85]} />
          <OrthographicCamera name="1" makeDefault={false} far={10000} near={-50000} />
          <hemisphereLight name="Default Ambient Light" intensity={2.36} color="#ebebeb" />
        </scene>
      </group>
    </>
  );
}
