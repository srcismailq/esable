// src/Background/animators/DashboardIdleAnimator.ts

export interface DashboardTransformSnapshot {
  centerCubeScale: [number, number, number];
  centerCubeRotation: [number, number, number];
}

export class DashboardIdleAnimator {
  // Center cube initial baseline states
  private currentScale: [number, number, number] =[60,60,60];
  private currentRotation: [number, number, number] =[0,0,0];

  private lerpValue(current: number, target: number, speed: number): number {
    return current + (target - current) * speed;
  }

  /**
   * Pure mathematical step for the dashboard lifecycle.
   * Drives the continuous ambient tumble or active query compute acceleration.
   */
  public step(delta: number, isProcessing: boolean): DashboardTransformSnapshot {
    // 1. Shift rotation velocity metrics dynamically based on processing states
    const targetSpinSpeedY = isProcessing ? 2.5 : 0.4;
    const targetSpinSpeedX = isProcessing ? 1.2 : 0.2;

    // Accumulate rotation smoothly over frame delta time ticks
    this.currentRotation[1] += delta * targetSpinSpeedY; // Y-Axis rotation
    this.currentRotation[0] += delta * targetSpinSpeedX; // X-Axis tumble

    // 2. Modulate visual scaling factors during active query computations
    const targetScaleSize = isProcessing ? 75 : 60;
    for (let i = 0; i < 3; i++) {
      this.currentScale[i] = this.lerpValue(this.currentScale[i], targetScaleSize, 0.1);
    }

    return {
      centerCubeScale: this.currentScale,
      centerCubeRotation: this.currentRotation,
    };
  }
}
