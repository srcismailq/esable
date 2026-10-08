// src/Background/animators/InfraBootAnimator.ts

export interface InfraBootConfig {
  exitCubeScaleValue: number; // Protected to prevent breaking Leva control signatures
}

export interface InfraBootSnapshot {
  cubeScale: [number, number, number];
  helixScale: [number, number, number];
  torusScale: [number, number, number];
  exitCubeScale: [number, number, number];
  exitCubeRotation: [number, number, number];
  colorMorphedAlpha: number; 
  isTimelineComplete: boolean;
}

export class InfraBootAnimator {
  private elapsedTransitionTime = 0;

  private currentCubeScale: [number, number, number] =[0,0,0]
  private currentHelixScale: [number, number, number] =[0,0,0]
  private currentTorusScale: [number, number, number] =[0,0,0]

  private currentExitScale: [number, number, number] =[0,0,0]
  private currentExitRotation: [number, number, number] =[0,0,0]

  constructor(private config: InfraBootConfig) {}

  private lerpValue(current: number, target: number, speed: number): number {
    return current + (target - current) * speed;
  }

  public step(delta: number, isExiting: boolean, progress: number, isProcessing: boolean = false): InfraBootSnapshot {
    
    // --- MODE 1: ACTIVE INFRASTRUCTURE BOOT SEQUENCE ---
    if (!isExiting) {
      this.elapsedTransitionTime = 0;

      const targetCubeFactor = progress >= 5 ? 1 : 0;
      const targetHelixFactor = progress >= 30 ? 1 : 0;
      const targetTorusFactor = progress >= 75 ? 1 : 0;

      for (let i = 0; i < 3; i++) {
        this.currentCubeScale[i] = this.lerpValue(this.currentCubeScale[i], targetCubeFactor, 0.1);
        this.currentHelixScale[i] = this.lerpValue(this.currentHelixScale[i], targetHelixFactor, 0.1);
        this.currentTorusScale[i] = this.lerpValue(this.currentTorusScale[i], targetTorusFactor, 0.1);
      }

      this.currentExitScale =[0,0,0]
      this.currentExitRotation =[0,0,0]

      return {
        cubeScale: this.currentCubeScale,
        helixScale: this.currentHelixScale,
        torusScale: this.currentTorusScale,
        exitCubeScale: this.currentExitScale,
        exitCubeRotation: this.currentExitRotation,
        colorMorphedAlpha: 0,
        isTimelineComplete: false,
      };
    }

    // --- MODE 2: THE 3D BRIDGE (SPAWN & SPIN BEFORE DASHBOARD LOADS) ---
    // --- MODE 2: THE 3D BRIDGE (SPAWN & SPIN BEFORE DASHBOARD LOADS) ---
    this.elapsedTransitionTime += delta;

    // 1. Contract original loading structures out of sight instantly
    for (let i = 0; i < 3; i++) {
      this.currentCubeScale[i] = this.lerpValue(this.currentCubeScale[i], 0, 0.15);
      this.currentHelixScale[i] = this.lerpValue(this.currentHelixScale[i], 0, 0.15);
      this.currentTorusScale[i] = this.lerpValue(this.currentTorusScale[i], 0, 0.15);
    }

    // 2. FIX: Lock target dashboard size to 60. It will NEVER grow past this into a wall.
    const targetDashboardSize = 60;
    for (let i = 0; i < 3; i++) {
      this.currentExitScale[i] = this.lerpValue(this.currentExitScale[i], targetDashboardSize, 0.08);
    }

    // 3. Keep continuous spin physics running safely
    const speedY = isProcessing ? 2.5 : 0.4;
    const speedX = isProcessing ? 1.2 : 0.2;

    this.currentExitRotation[1] += delta * speedY;
    this.currentExitRotation[0] += delta * speedX;

    // Hold the loading text visible for 1.2 seconds so it materializes and tumbles first
    const arrivalDelayWindow = 1.2; 
    const isTimelineComplete = this.elapsedTransitionTime >= arrivalDelayWindow;

    return {
      cubeScale: this.currentCubeScale,
      helixScale: this.currentHelixScale,
      torusScale: this.currentTorusScale,
      exitCubeScale: this.currentExitScale,
      exitCubeRotation: this.currentExitRotation,
      colorMorphedAlpha: 0,
      isTimelineComplete, 
    };
  }
}
