// src/Background/components/DashboardVisuals.tsx
import { type RefObject } from 'react';
import { type Mesh } from 'three';

interface DashboardVisualsProps {
  centerCubeRef: RefObject<Mesh | null>;
  cubeColor: string;
}

export default function DashboardVisuals({ centerCubeRef, cubeColor }: DashboardVisualsProps) {
  return (
    <mesh ref={centerCubeRef} position={[0, 0, -400]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={cubeColor} />
    </mesh>
  );
}
