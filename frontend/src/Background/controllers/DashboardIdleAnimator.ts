// src/Background/controllers/DashboardIdleAnimator.ts
import { type RefObject } from 'react';
import { type Mesh, Color } from 'three';
import gsap from 'gsap';
import { ANIMATION_CONFIG } from '../config/animationConfig';

export class DashboardIdleAnimator {
  // Reference to our infinite linear tumbling animation loop
  private ambientTumbleTween: gsap.core.Tween | null = null;
  
  // Trackers to prevent building duplicate processing tweens over existing ones
  private currentProcessingState: boolean | null = null;

  constructor(
    private centerCubeRef: RefObject<Mesh | null>,
    private cubeColor: string
  ) {}

  /**
   * Seamlessly activates the dashboard loop. It captures the mesh exactly where
   * the exit bridge left off and attaches a continuous linear tumble.
   */
  public activate(): void {
    // If the ambient loop is already running, safeguard against duplicating it
    if (this.ambientTumbleTween) return;

    const mesh = this.centerCubeRef.current;
    if (!mesh) return;

    // Reset the material color back to full brand vibrancy upon entering the dashboard phase
    const material = mesh.material as any;
    if (material && material.color) {
      material.color.copy(new Color(this.cubeColor));
    }

    // Anti-Stutter: Append relative rotation vectors to whatever values the mesh holds right now
    this.ambientTumbleTween = gsap.to(mesh.rotation, {
      x: '+=6.28', // Core 360-degree linear ambient tumble loops
      y: '+=6.28',
      duration: 12,
      repeat: -1,
      ease: 'none'
    });
  }

  /**
   * Intercepts application calculation states. Handles the upscaling/downscaling transitions
   * and modulates tumble velocities during text-engine fetch cycles.
   */
  public updateProcessingState(isProcessing: boolean): void {
    // Guard clause: Only recalculate positions if an actual state switch has occurred
    if (this.currentProcessingState === isProcessing) return;
    this.currentProcessingState = isProcessing;

    const mesh = this.centerCubeRef.current;
    if (!mesh) return;

    const { SCALES, DURATIONS } = ANIMATION_CONFIG;

    if (isProcessing) {
      // 1. Smoothly upscale geometry to calculation baseline (75)
      gsap.to(mesh.scale, {
        x: SCALES.CENTER_CUBE_PROCESSING,
        y: SCALES.CENTER_CUBE_PROCESSING,
        z: SCALES.CENTER_CUBE_PROCESSING,
        duration: DURATIONS.PROCESSING_TWEEN,
        ease: 'power2.out'
      });

      // 2. Accelerate ambient tumble velocity dynamically by shortening tween duration
      if (this.ambientTumbleTween) {
        gsap.to(this.ambientTumbleTween, { timeScale: 4.5, duration: DURATIONS.PROCESSING_TWEEN, ease: 'power1.out' });
      }
    } else {
      // 1. Smoothly contract geometry back to standard workspace size (60)
      gsap.to(mesh.scale, {
        x: SCALES.CENTER_CUBE_BASELINE,
        y: SCALES.CENTER_CUBE_BASELINE,
        z: SCALES.CENTER_CUBE_BASELINE,
        duration: DURATIONS.PROCESSING_TWEEN,
        ease: 'power2.out'
      });

      // 2. Return rotation velocity back to standard relaxed tempo
      if (this.ambientTumbleTween) {
        gsap.to(this.ambientTumbleTween, { timeScale: 1.0, duration: DURATIONS.PROCESSING_TWEEN, ease: 'power1.out' });
      }
    }
  }

  /**
   * Clears engine pointers and halts active timers to prevent memory leaks when components unmount.
   */
  public destroy(): void {
    if (this.ambientTumbleTween) {
      this.ambientTumbleTween.kill();
      this.ambientTumbleTween = null;
    }
    
    if (this.centerCubeRef.current) {
      gsap.killTweensOf(this.centerCubeRef.current.scale);
      gsap.killTweensOf(this.centerCubeRef.current.rotation);
      
      const material = this.centerCubeRef.current.material as any;
      if (material && material.color) {
        gsap.killTweensOf(material.color);
      }
    }
    
    this.currentProcessingState = null;
  }
}
