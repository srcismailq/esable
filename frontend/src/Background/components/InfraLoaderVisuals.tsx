// src/Background/components/InfraLoaderVisuals.tsx
import { type RefObject } from 'react';
import { type Mesh } from 'three';

interface InfraLoaderVisualsProps {
  nodes: any;
  materials: any;
  cubeRef: RefObject<Mesh | null>;
  helixRef: RefObject<Mesh | null>;
  torusRef: RefObject<Mesh | null>;
}

export default function InfraLoaderVisuals({ nodes, materials, cubeRef, helixRef, torusRef }: InfraLoaderVisualsProps) {
  return (
    <>
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
    </>
  );
}
