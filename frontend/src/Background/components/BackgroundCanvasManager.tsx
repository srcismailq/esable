import { useRef, useEffect } from 'react';
import useSpline from '@splinetool/r3f-spline';
import { useControls } from 'leva';
import { type Mesh, Color } from 'three';
import { useFrame } from '@react-three/fiber';
import { useAppOrchestrator } from '../../store/useAppOrchestrator';
import { ANIMATION_CONFIG } from '../config/animationConfig';
import { BackgroundAnimationEngine } from '../services/BackgroundAnimationEngine';
import BackgroundSceneView from './BackgroundSceneView';
import gsap from 'gsap';

export default function BackgroundCanvasManager() {
  const { nodes, materials } = useSpline('https://prod.spline.design/sghG1VPRzVqp3B0U/scene.splinecode');

  // View Element References
  const loaderCubeRef = useRef<Mesh>(null);
  const loaderHelixRef = useRef<Mesh>(null);
  const loaderTorusRef = useRef<Mesh>(null);
  const centerCubeRef = useRef<Mesh>(null);

  // Leva Visual Control Inputs
  const { cubeColor } = useControls('Exit Control Timeline', {
    cubeColor: { value: '#ed8529', label: 'Cube Color' },
  });

  // 🎯 THE ENGINE HANDLER INSTANCE: The isolated state calculations core
  const engine = useRef(new BackgroundAnimationEngine());

  // Mutable Animation Handles (Stored cleanly outside React lifecycle states)
  const ambientTumbleTween = useRef<gsap.core.Tween | null>(null);
  const exitTimelineRef = useRef<gsap.core.Timeline | null>(null);

  // Clean layout cleanup routine on unmount
  useEffect(() => {
    return () => {
      if (ambientTumbleTween.current) ambientTumbleTween.current.kill();
      if (exitTimelineRef.current) exitTimelineRef.current.kill();
    };
  }, []);

  // Synchronous Reactivity Layer: Binds changes back to mutable properties smoothly
  useEffect(() => {
    if (centerCubeRef.current) {
      const material = centerCubeRef.current.material as any;
      if (material && material.color) {
        material.color.copy(new Color(cubeColor));
      }
    }
  }, [cubeColor]);

  useFrame((state, delta) => {
    const storeState = useAppOrchestrator.getState();
    const { progress } = storeState.loadingView;
    const { isQueryActive, setInterfaceVisible } = storeState.dashboardView;
    
    const mesh = centerCubeRef.current;
    if (!mesh) return;

    const { SCALES, DURATIONS, COLORS } = ANIMATION_CONFIG;

    // Evaluate live element boundaries to detect cache hits / immediate bypasses
    const loadersVisible = !!(loaderCubeRef.current && loaderCubeRef.current.scale.x > 0);

    // 1. ACT: Feed primitive parameters into our verified contract engine
    const commands = engine.current.update({
      delta,
      progress,
      isQueryActive,
      loadersWereVisible: loadersVisible,
    });

    // 2. ASSERT & EXECUTE: Map mathematical signals to physical animations blindly

    // --- Milestone Reveals ---
    if (commands.triggerLoaderReveal === 'cube' && loaderCubeRef.current) {
      gsap.to(loaderCubeRef.current.scale, { x: SCALES.LOADER_MAX, y: SCALES.LOADER_MAX, z: SCALES.LOADER_MAX, duration: 0.5, ease: 'back.out(1.7)' });
      gsap.to(loaderCubeRef.current.rotation, { x: '+=6.28', y: '+=6.28', duration: 8, repeat: -1, ease: 'none' });
    }
    if (commands.triggerLoaderReveal === 'helix' && loaderHelixRef.current) {
      gsap.to(loaderHelixRef.current.scale, { x: SCALES.LOADER_MAX, y: SCALES.LOADER_MAX, z: SCALES.LOADER_MAX, duration: 0.5, ease: 'back.out(1.7)' });
      gsap.to(loaderHelixRef.current.rotation, { y: '-=6.28', duration: 5, repeat: -1, ease: 'none' });
    }
    if (commands.triggerLoaderReveal === 'torus' && loaderTorusRef.current) {
      gsap.to(loaderTorusRef.current.scale, { x: SCALES.LOADER_MAX, y: SCALES.LOADER_MAX, z: SCALES.LOADER_MAX, duration: 0.5, ease: 'back.out(1.7)' });
      gsap.to(loaderTorusRef.current.rotation, { x: '+=6.28', z: '+=6.28', duration: 6, repeat: -1, ease: 'none' });
    }

    // --- Structural Exit Explosions ---
    if (commands.triggerExitBurst) {
      if (loaderCubeRef.current) gsap.killTweensOf(loaderCubeRef.current.rotation);
      if (loaderHelixRef.current) gsap.killTweensOf(loaderHelixRef.current.rotation);
      if (loaderTorusRef.current) gsap.killTweensOf(loaderTorusRef.current.rotation);

      const targets = [loaderCubeRef.current?.scale, loaderHelixRef.current?.scale, loaderTorusRef.current?.scale].filter(Boolean);

      exitTimelineRef.current = gsap.timeline({
        delay: 0.05,
        onComplete: () => {
          // Fire handoff explicitly back to the engine once visual linear burst maps finish
          engine.current.notifyExitBurstComplete();
          exitTimelineRef.current = null;
        }
      });

      exitTimelineRef.current
        .to(targets, { x: 0, y: 0, z: 0, duration: 0.4, ease: 'power2.in' }, 0)
        .to(mesh.scale, { x: SCALES.CENTER_CUBE_BASELINE, y: SCALES.CENTER_CUBE_BASELINE, z: SCALES.CENTER_CUBE_BASELINE, duration: DURATIONS.EXIT_BRIDGE, ease: 'power3.out' }, 0)
        .to(mesh.rotation, { x: '+=6.28', y: '+=9.42', duration: DURATIONS.EXIT_BRIDGE, ease: 'linear' }, 0);

      const material = mesh.material as any;
      if (material && material.color) {
        const targetColor = new Color(COLORS.TARGET_BACKGROUND);
        exitTimelineRef.current.to(material.color, { r: targetColor.r, g: targetColor.g, b: targetColor.b, duration: DURATIONS.EXIT_BRIDGE, ease: 'power2.out' }, 0);
      }
    }

    // --- Isolated Loops Spin Setup ---
    if (commands.triggerFastSpinLoopInit) {
      const material = mesh.material as any;
      if (material && material.color) material.color.copy(new Color(cubeColor));

      ambientTumbleTween.current = gsap.to(mesh.rotation, {
        x: '+=6.28', y: '+=6.28', duration: 6, repeat: -1, ease: 'none'
      });
      gsap.set(ambientTumbleTween.current, { timeScale: 5.0 });
    }

    // --- Interactive Speeds / Timescale Shifting ---
    if (commands.setInteractiveTimescale !== null) {
      // Direct asset mutation without forcing React to run costly UI re-renders!
      if (ambientTumbleTween.current) {
        gsap.to(ambientTumbleTween.current, {
          timeScale: commands.setInteractiveTimescale,
          duration: commands.setInteractiveTimescale === 1.0 ? 2.2 : DURATIONS.PROCESSING_TWEEN,
          ease: commands.setInteractiveTimescale === 1.0 ? 'power3.out' : 'power1.out',
        });
      }

      // Handle raw static setups for immediate fast-forward reloads
      if (commands.setInteractiveTimescale === 1.0 && !ambientTumbleTween.current) {
        gsap.set(mesh.scale, { x: SCALES.CENTER_CUBE_BASELINE, y: SCALES.CENTER_CUBE_BASELINE, z: SCALES.CENTER_CUBE_BASELINE });
        ambientTumbleTween.current = gsap.to(mesh.rotation, { x: '+=6.28', y: '+=6.28', duration: 12, repeat: -1, ease: 'none' });
      }

      // Handle interactive scale alterations on idle processing cycles
      if (commands.setInteractiveTimescale === 4.5) {
        gsap.to(mesh.scale, { x: SCALES.CENTER_CUBE_PROCESSING, y: SCALES.CENTER_CUBE_PROCESSING, z: SCALES.CENTER_CUBE_PROCESSING, duration: DURATIONS.PROCESSING_TWEEN, ease: 'power2.out' });
      } else if (commands.setInteractiveTimescale === 1.0 && progress === 100 && loadersVisible === false) {
        gsap.to(mesh.scale, { x: SCALES.CENTER_CUBE_BASELINE, y: SCALES.CENTER_CUBE_BASELINE, z: SCALES.CENTER_CUBE_BASELINE, duration: DURATIONS.PROCESSING_TWEEN, ease: 'power2.out' });
      }
    }

    // --- State Synchronization Output Gates ---
    if (commands.updateInterfaceVisibility !== null) {
      setInterfaceVisible(commands.updateInterfaceVisibility);
    }

    // 🎯 HARD PURGE EXECUTED ONLY ON A GENUINE EMERGENCY RESET EVENT
    if (commands.triggerEmergencyReset) {
      if (exitTimelineRef.current) { exitTimelineRef.current.kill(); exitTimelineRef.current = null; }
      if (ambientTumbleTween.current) { ambientTumbleTween.current.kill(); ambientTumbleTween.current = null; }
      gsap.set(mesh.scale, { x: 0, y: 0, z: 0 });
      gsap.set(mesh.rotation, { x: 0, y: 0, z: 0 });
      
      if (loaderCubeRef.current) gsap.set(loaderCubeRef.current.scale, { x: 0, y: 0, z: 0 });
      if (loaderHelixRef.current) gsap.set(loaderHelixRef.current.scale, { x: 0, y: 0, z: 0 });
      if (loaderTorusRef.current) gsap.set(loaderTorusRef.current.scale, { x: 0, y: 0, z: 0 });
    }
  });

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
