// src/Background/components/BackgroundCanvasManager.tsx
import { useRef, useEffect } from 'react';
import useSpline from '@splinetool/r3f-spline';
import { useControls } from 'leva';
import { type Mesh, Color } from 'three';
import { useGSAP } from '@gsap/react';
import { type StreamState } from '../../LoadingScreen/InfrastructureStreamManager';
import { ANIMATION_CONFIG } from '../config/animationConfig';
import BackgroundSceneView from './BackgroundSceneView';
import gsap from 'gsap';

interface BackgroundCanvasManagerProps {
  visualPhase: 'streaming' | 'animating' | 'done';
  statusSnapshot: StreamState;
  isProcessing: boolean;
  onScreenMasked: () => void;
}

export default function BackgroundCanvasManager({
  visualPhase,
  statusSnapshot,
  isProcessing,
  onScreenMasked,
}: BackgroundCanvasManagerProps) {
  const { nodes, materials } = useSpline('https://prod.spline.design/sghG1VPRzVqp3B0U/scene.splinecode');

  const loaderCubeRef = useRef<Mesh>(null);
  const loaderHelixRef = useRef<Mesh>(null);
  const loaderTorusRef = useRef<Mesh>(null);
  const centerCubeRef = useRef<Mesh>(null);

  const { cubeColor } = useControls('Exit Control Timeline', {
    cubeColor: { value: '#ed8529', label: 'Cube Color' },
  });

  const trackingRef = useRef({
    cubeSpawned: false,
    helixSpawned: false,
    torusSpawned: false,
    exitTriggered: false,
    dashboardActivated: false,
  });
  
  const ambientTumbleTween = useRef<gsap.core.Tween | null>(null);

  // Clean mount/unmount memory flags supervisor loop
  useEffect(() => {
    trackingRef.current = {
      cubeSpawned: false,
      helixSpawned: false,
      torusSpawned: false,
      exitTriggered: false,
      dashboardActivated: false,
    };
    return () => {
      if (ambientTumbleTween.current) {
        ambientTumbleTween.current.kill();
        ambientTumbleTween.current = null;
      }
      gsap.killTweensOf([
        loaderCubeRef.current?.scale,
        loaderHelixRef.current?.scale,
        loaderTorusRef.current?.scale,
        centerCubeRef.current?.scale,
        centerCubeRef.current?.rotation
      ].filter(Boolean));
    };
  }, []);

  // Isolated progress milestone supervisor hook
  useEffect(() => {
    if (visualPhase !== 'streaming') return;

    const progress = statusSnapshot?.progress ?? 0;
    const { MILESTONES, SCALES } = ANIMATION_CONFIG;

    if (progress >= MILESTONES.CUBE && !trackingRef.current.cubeSpawned && loaderCubeRef.current) {
      trackingRef.current.cubeSpawned = true;
      gsap.to(loaderCubeRef.current.scale, { x: SCALES.LOADER_MAX, y: SCALES.LOADER_MAX, z: SCALES.LOADER_MAX, duration: 0.5, ease: 'back.out(1.7)' });
      gsap.to(loaderCubeRef.current.rotation, { x: '+=6.28', y: '+=6.28', duration: 8, repeat: -1, ease: 'none' });
    }

    if (progress >= MILESTONES.HELIX && !trackingRef.current.helixSpawned && loaderHelixRef.current) {
      trackingRef.current.helixSpawned = true;
      gsap.to(loaderHelixRef.current.scale, { x: SCALES.LOADER_MAX, y: SCALES.LOADER_MAX, z: SCALES.LOADER_MAX, duration: 0.5, ease: 'back.out(1.7)' });
      gsap.to(loaderHelixRef.current.rotation, { y: '-=6.28', duration: 5, repeat: -1, ease: 'none' });
    }

    if (progress >= MILESTONES.TORUS && !trackingRef.current.torusSpawned && loaderTorusRef.current) {
      trackingRef.current.torusSpawned = true;
      gsap.to(loaderTorusRef.current.scale, { x: SCALES.LOADER_MAX, y: SCALES.LOADER_MAX, z: SCALES.LOADER_MAX, duration: 0.5, ease: 'back.out(1.7)' });
      gsap.to(loaderTorusRef.current.rotation, { x: '+=6.28', z: '+=6.28', duration: 6, repeat: -1, ease: 'none' });
    }
  }, [statusSnapshot?.progress, visualPhase]);

  // Stable engine lifecycle supervisor hook
  useGSAP(() => {
    const { SCALES, DURATIONS, COLORS } = ANIMATION_CONFIG;

    // --- PHASE 2: ANIMATING (1.2s Exit Bridge) ---
    if (visualPhase === 'animating' && !trackingRef.current.exitTriggered && centerCubeRef.current) {
      trackingRef.current.exitTriggered = true;

      if (loaderCubeRef.current) gsap.killTweensOf(loaderCubeRef.current.rotation);
      if (loaderHelixRef.current) gsap.killTweensOf(loaderHelixRef.current.rotation);
      if (loaderTorusRef.current) gsap.killTweensOf(loaderTorusRef.current.rotation);

      const targets = [loaderCubeRef.current?.scale, loaderHelixRef.current?.scale, loaderTorusRef.current?.scale].filter(Boolean);

      const exitTimeline = gsap.timeline({
        delay: 0.05, 
        onComplete: () => {
          onScreenMasked();
        }
      });

      exitTimeline
        .to(targets, { x: 0, y: 0, z: 0, duration: 0.4, ease: 'power2.in' }, 0)
        .to(centerCubeRef.current.scale, { x: SCALES.CENTER_CUBE_BASELINE, y: SCALES.CENTER_CUBE_BASELINE, z: SCALES.CENTER_CUBE_BASELINE, duration: DURATIONS.EXIT_BRIDGE, ease: 'power3.out' }, 0)
        // 🎯 MOMENTUM BUFFER: Increase rotation distance and use a perfectly smooth linear tracking curve
        // This keeps the cube spinning fluidly, masking the brief single-frame DOM mount lag
        .to(centerCubeRef.current.rotation, { 
          x: '+=6.28', 
          y: '+=9.42', 
          duration: DURATIONS.EXIT_BRIDGE, 
          ease: 'linear' 
        }, 0);

      const material = centerCubeRef.current.material as any;
      if (material && material.color) {
        const targetColor = new Color(COLORS.TARGET_BACKGROUND);
        exitTimeline.to(material.color, { r: targetColor.r, g: targetColor.g, b: targetColor.b, duration: DURATIONS.EXIT_BRIDGE, ease: 'power2.out' }, 0);
      }
    }

    // --- PHASE 3: DONE (Dashboard Atmosphere Loops) ---
    if (visualPhase === 'done' && centerCubeRef.current) {
      if (!trackingRef.current.dashboardActivated) {
        trackingRef.current.dashboardActivated = true;

        const material = centerCubeRef.current.material as any;
        if (material && material.color) {
          material.color.copy(new Color(cubeColor));
        }

        // 1. Initialize the baseline slow ambient loop relatively
        ambientTumbleTween.current = gsap.to(centerCubeRef.current.rotation, {
          x: '+=6.28',
          y: '+=6.28',
          duration: 12,
          repeat: -1,
          ease: 'none'
        });

        // 🎯 THE PERFECT MATHEMATICAL HANDOFF DETECTED:
        // Force the loop timescale to match the exit velocity (15.0) on frame zero,
        // then smoothly stretch the decay window out to 2.2 seconds for a premium wind-down.
        (trackingRef.current as any).isLandingDecelerating = true;

        gsap.set(ambientTumbleTween.current, { timeScale: 15.0 }); // 🎯 MATCHES EXIT VELOCITY EXACTLY
        gsap.to(ambientTumbleTween.current, {
          timeScale: 1.0,
          duration: 2.2, // 🎯 Cushion the deceleration curve
          ease: 'power3.out', // Deep cushion curve to drop fast then drift slow
          onComplete: () => {
            (trackingRef.current as any).isLandingDecelerating = false;
          }
        });
      }

      // 2. Handle interactive text-computation velocity scaling transitions
      if (isProcessing) {
        gsap.to(centerCubeRef.current.scale, { x: SCALES.CENTER_CUBE_PROCESSING, y: SCALES.CENTER_CUBE_PROCESSING, z: SCALES.CENTER_CUBE_PROCESSING, duration: DURATIONS.PROCESSING_TWEEN, ease: 'power2.out' });
        if (ambientTumbleTween.current) {
          (trackingRef.current as any).isLandingDecelerating = false;
          gsap.killTweensOf(ambientTumbleTween.current);
          gsap.to(ambientTumbleTween.current, { timeScale: 4.5, duration: DURATIONS.PROCESSING_TWEEN, ease: 'power1.out' });
        }
      } else {
        gsap.to(centerCubeRef.current.scale, { x: SCALES.CENTER_CUBE_BASELINE, y: SCALES.CENTER_CUBE_BASELINE, z: SCALES.CENTER_CUBE_BASELINE, duration: DURATIONS.PROCESSING_TWEEN, ease: 'power2.out' });
        
        if (ambientTumbleTween.current && !(trackingRef.current as any).isLandingDecelerating) {
          gsap.to(ambientTumbleTween.current, { timeScale: 1.0, duration: DURATIONS.PROCESSING_TWEEN, ease: 'power1.out' });
        }
      }
    }
  }, { dependencies: [visualPhase, isProcessing, cubeColor] });

  return (
    <BackgroundSceneView
      nodes={nodes}
      materials={materials}
      loaderCubeRef={loaderCubeRef}
      loaderHelixRef={loaderHelixRef}
      loaderTorusRef={loaderTorusRef}
      centerCubeRef={centerCubeRef}
      cubeColor={cubeColor}
    />
  );
}
