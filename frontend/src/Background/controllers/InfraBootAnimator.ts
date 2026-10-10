// src/Background/controllers/InfraBootAnimator.ts
import { type RefObject } from 'react';
import { type Mesh, Color } from 'three';
import gsap from 'gsap';
import { ANIMATION_CONFIG } from '../config/animationConfig';

export class InfraBootAnimator {
  // Master timeline for the 1.2s exit bridge
  private exitTimeline: gsap.core.Timeline | null = null;

  // Trackers to guarantee entry animations fire exactly once per milestone
  private milestonesTriggered = {
    cube: false,
    helix: false,
    torus: false,
  };

  constructor(
    private loaderCubeRef: RefObject<Mesh | null>,
    private loaderHelixRef: RefObject<Mesh | null>,
    private loaderTorusRef: RefObject<Mesh | null>,
    private centerCubeRef: RefObject<Mesh | null>,
    private cubeColor: string // Maintained safely for constructor contract signature matching
  ) {}

  /**
   * Safe initialization step. Forces all components to their baseline starting properties
   * the exact frame the canvas manager mounts into the DOM.
   */
  public setupInitialState(): void {
    if (this.loaderCubeRef.current) gsap.set(this.loaderCubeRef.current.scale, { x: 0, y: 0, z: 0 });
    if (this.loaderHelixRef.current) gsap.set(this.loaderHelixRef.current.scale, { x: 0, y: 0, z: 0 });
    if (this.loaderTorusRef.current) gsap.set(this.loaderTorusRef.current.scale, { x: 0, y: 0, z: 0 });
    if (this.centerCubeRef.current) {
      gsap.set(this.centerCubeRef.current.scale, { x: 0, y: 0, z: 0 });
      gsap.set(this.centerCubeRef.current.rotation, { x: 0, y: 0, z: 0 });
    }
  }

  /**
   * Core Progress Evaluator. Evaluates the incoming network stream progress and triggers 
   * localized scale reveals and linear ambient spin loops when thresholds are crossed.
   */
  public updateProgress(progress: number): void {
    const { MILESTONES, SCALES } = ANIMATION_CONFIG;

    // 1. Reveal Loader Cube (Progress >= 5)
    if (progress >= MILESTONES.CUBE && !this.milestonesTriggered.cube) {
      this.milestonesTriggered.cube = true;
      const mesh = this.loaderCubeRef.current;
      if (mesh) {
        gsap.to(mesh.scale, { x: SCALES.LOADER_MAX, y: SCALES.LOADER_MAX, z: SCALES.LOADER_MAX, duration: 0.5, ease: 'back.out(1.7)' });
        gsap.to(mesh.rotation, { x: '+=6.28', y: '+=6.28', duration: 8, repeat: -1, ease: 'none' });
      }
    }

    // 2. Reveal Loader Helix (Progress >= 30)
    if (progress >= MILESTONES.HELIX && !this.milestonesTriggered.helix) {
      this.milestonesTriggered.helix = true;
      const mesh = this.loaderHelixRef.current;
      if (mesh) {
        gsap.to(mesh.scale, { x: SCALES.LOADER_MAX, y: SCALES.LOADER_MAX, z: SCALES.LOADER_MAX, duration: 0.5, ease: 'back.out(1.7)' });
        gsap.to(mesh.rotation, { y: '-=6.28', duration: 5, repeat: -1, ease: 'none' });
      }
    }

    // 3. Reveal Loader Torus (Progress >= 75)
    if (progress >= MILESTONES.TORUS && !this.milestonesTriggered.torus) {
      this.milestonesTriggered.torus = true;
      const mesh = this.loaderTorusRef.current;
      if (mesh) {
        gsap.to(mesh.scale, { x: SCALES.LOADER_MAX, y: SCALES.LOADER_MAX, z: SCALES.LOADER_MAX, duration: 0.5, ease: 'back.out(1.7)' });
        gsap.to(mesh.rotation, { x: '+=6.28', z: '+=6.28', duration: 6, repeat: -1, ease: 'none' });
      }
    }
  }

  /**
   * The 3D Exit Bridge. Orchestrates the synchronized 1.2-second timeline transition that
   * contracts loaders, reveals the centerpiece, and morphs its environmental surface color.
   */
  public executeExitBridge(onComplete: () => void): void {
    // Prevent double invocation if the react render tree hits a duplicate animating phase tick
    if (this.exitTimeline) return;

    // Type Check Safeguard: Enforce presence of the core element before initializing the timeline
    if (!this.centerCubeRef.current) return;

    const { SCALES, DURATIONS, COLORS } = ANIMATION_CONFIG;

    // 1. Wipe out old spinning animations to prevent property overwrites
    if (this.loaderCubeRef.current) gsap.killTweensOf(this.loaderCubeRef.current.rotation);
    if (this.loaderHelixRef.current) gsap.killTweensOf(this.loaderHelixRef.current.rotation);
    if (this.loaderTorusRef.current) gsap.killTweensOf(this.loaderTorusRef.current.rotation);

    // 2. Safely collect active loader scales into an array, filtering out any unmounted instances
    const activeTargets: any[] = [];
    if (this.loaderCubeRef.current) activeTargets.push(this.loaderCubeRef.current.scale);
    if (this.loaderHelixRef.current) activeTargets.push(this.loaderHelixRef.current.scale);
    if (this.loaderTorusRef.current) activeTargets.push(this.loaderTorusRef.current.scale);

    // 3. Construct unified exit orchestration timeline
    this.exitTimeline = gsap.timeline({
      onComplete: () => {
        onComplete();
      }
    });

    // 4. Chain concrete, validated elements onto the timeline sequence
    if (activeTargets.length > 0) {
      this.exitTimeline.to(activeTargets, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.4,
        ease: 'power2.in'
      }, 0);
    }

    this.exitTimeline
      // Upscale Center Cube to its stable workspace size of 60
      .to(this.centerCubeRef.current.scale, {
        x: SCALES.CENTER_CUBE_BASELINE,
        y: SCALES.CENTER_CUBE_BASELINE,
        z: SCALES.CENTER_CUBE_BASELINE,
        duration: DURATIONS.EXIT_BRIDGE,
        ease: 'power3.out'
      }, 0)
      
      // Inject an energetic rotation tumble directly into the mesh vectors
      .to(this.centerCubeRef.current.rotation, {
        x: '+=3.14',
        y: '+=4.71',
        duration: DURATIONS.EXIT_BRIDGE,
        ease: 'power2.out'
      }, 0);

    // 5. Utilize native Three.js Color parsing directly on target channels
    const material = this.centerCubeRef.current.material as any;
    if (material && material.color) {
      const parsedTargetColor = new Color(COLORS.TARGET_BACKGROUND);
      
      this.exitTimeline.to(material.color, {
        r: parsedTargetColor.r,
        g: parsedTargetColor.g,
        b: parsedTargetColor.b,
        duration: DURATIONS.EXIT_BRIDGE,
        ease: 'power2.out'
      }, 0);
    }
  }

  /**
   * Explicit cleanup module. Purges all scheduled tween allocations out of the GSAP memory index
   * when this phase hands operational execution over to the dashboard.
   */
  public destroy(): void {
    if (this.exitTimeline) {
      this.exitTimeline.kill();
      this.exitTimeline = null;
    }
    
    [this.loaderCubeRef, this.loaderHelixRef, this.loaderTorusRef].forEach(ref => {
      if (ref.current) {
        gsap.killTweensOf(ref.current.scale);
        gsap.killTweensOf(ref.current.rotation);
      }
    });
  }
}
