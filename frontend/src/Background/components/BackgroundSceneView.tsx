// src/Background/components/BackgroundSceneView.tsx
import { type RefObject } from 'react';
import { PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { type Mesh } from 'three';
import InfraLoaderVisuals from './InfraLoaderVisuals';
import DashboardVisuals from './DashboardVisuals';

interface BackgroundSceneViewProps {
  nodes: any;
  materials: any;
  loaderCubeRef: RefObject<Mesh | null>;
  loaderHelixRef: RefObject<Mesh | null>;
  loaderTorusRef: RefObject<Mesh | null>;
  centerCubeRef: RefObject<Mesh | null>;
  cubeColor: string;
}

export default function BackgroundSceneView({
  nodes,
  materials,
  loaderCubeRef,
  loaderHelixRef,
  loaderTorusRef,
  centerCubeRef,
  cubeColor,
}: BackgroundSceneViewProps) {
  return (
    <>
      <color attach="background" args={['#0D1026']} />
      
      <scene name="Scene 1">
        {/* Loader Shapes Presentation Layer */}
        <InfraLoaderVisuals 
          nodes={nodes} 
          materials={materials}
          cubeRef={loaderCubeRef}
          helixRef={loaderHelixRef}
          torusRef={loaderTorusRef}
        />

        {/* Dashboard Center Cube Mount Layer */}
        <PerspectiveCamera 
          name="Camera" 
          makeDefault 
          far={100000} 
          near={70} 
          fov={45} 
          position={[6.07, 230.36, 2147.87]} 
          rotation={[-0.1, 0.04, 0]}
        >
          <DashboardVisuals 
            centerCubeRef={centerCubeRef}
            cubeColor={cubeColor}
          />
        </PerspectiveCamera>

        {/* Static Scene Environment Elements */}
        <directionalLight name="Directional Light" castShadow intensity={2.2} position={[200, 715.92, 832.85]} />
        <OrthographicCamera name="1" makeDefault={false} far={10000} near={-50000} />
        <hemisphereLight name="Default Ambient Light" intensity={2.36} color="#ebebeb" />
      </scene>
    </>
  );
}
