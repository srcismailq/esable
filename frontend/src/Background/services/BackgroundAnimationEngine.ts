import { ANIMATION_CONFIG } from '../config/animationConfig';

export type VisualPhase = 'loading' | 'burstIsolation' | 'decelerating' | 'idle';

export interface EngineInput {
  delta: number;
  progress: number;
  isQueryActive: boolean;
  loadersWereVisible: boolean;
}

export interface EngineCommands {
  triggerLoaderReveal: 'none' | 'cube' | 'helix' | 'torus';
  triggerExitBurst: boolean;
  triggerFastSpinLoopInit: boolean;
  updateInterfaceVisibility: boolean | null;
  setInteractiveTimescale: number | null;
  triggerEmergencyReset: boolean; // 🎯 Part of the public contract
}

export class BackgroundAnimationEngine {
  private currentPhase: VisualPhase = 'loading';
  private phaseTimer = 0;
  private triggeredMilestones = new Set<'cube' | 'helix' | 'torus'>();
  private initialHandoffCompleted = false;
  private highestProgressSeen = 0;

  public update(input: EngineInput): EngineCommands {
    const { delta, progress, isQueryActive, loadersWereVisible } = input;
    const isReady = progress === 100;

    // ⚡ EMERGENCY RESET SHIELD: Trigger ONLY if progress drops backward out of a ready state
    if (progress < this.highestProgressSeen && this.highestProgressSeen === 100) {
      this.currentPhase = 'loading';
      this.phaseTimer = 0;
      this.triggeredMilestones.clear();
      this.initialHandoffCompleted = false;
      this.highestProgressSeen = progress;

      return {
        triggerLoaderReveal: 'none',
        triggerExitBurst: false,
        triggerFastSpinLoopInit: false,
        updateInterfaceVisibility: false,
        setInteractiveTimescale: null,
        triggerEmergencyReset: true, // Fire hard reset event exactly once
      };
    }

    // Track historical high progress to catch hard infra resets safely
    if (progress > this.highestProgressSeen) {
      this.highestProgressSeen = progress;
    }

    // --- PHASE MANAGEMENT MATRIX ---
    switch (this.currentPhase) {
      case 'loading': {
        if (isReady) {
          if (loadersWereVisible) {
            this.currentPhase = 'burstIsolation';
            return {
              triggerLoaderReveal: 'none',
              triggerExitBurst: true,
              triggerFastSpinLoopInit: false,
              updateInterfaceVisibility: null,
              setInteractiveTimescale: null,
              triggerEmergencyReset: false,
            };
          } else {
            this.currentPhase = 'idle';
            return {
              triggerLoaderReveal: 'none',
              triggerExitBurst: false,
              triggerFastSpinLoopInit: false,
              updateInterfaceVisibility: true,
              setInteractiveTimescale: 1.0,
              triggerEmergencyReset: false,
            };
          }
        }

        const { MILESTONES } = ANIMATION_CONFIG;
        let revealTarget: 'none' | 'cube' | 'helix' | 'torus' = 'none';

        if (progress >= MILESTONES.CUBE && !this.triggeredMilestones.has('cube')) {
          this.triggeredMilestones.add('cube');
          revealTarget = 'cube';
        } else if (progress >= MILESTONES.HELIX && !this.triggeredMilestones.has('helix')) {
          this.triggeredMilestones.add('helix');
          revealTarget = 'helix';
        } else if (progress >= MILESTONES.TORUS && !this.triggeredMilestones.has('torus')) {
          this.triggeredMilestones.add('torus');
          revealTarget = 'torus';
        }

        return {
          triggerLoaderReveal: revealTarget,
          triggerExitBurst: false,
          triggerFastSpinLoopInit: false,
          updateInterfaceVisibility: this.triggeredMilestones.size === 0 ? false : null, // Locks UI container away instantly on frame zero
          setInteractiveTimescale: null,
          triggerEmergencyReset: false,
        };
      }

      case 'burstIsolation': {
        return {
          triggerLoaderReveal: 'none',
          triggerExitBurst: false,
          triggerFastSpinLoopInit: false,
          updateInterfaceVisibility: null,
          setInteractiveTimescale: null,
          triggerEmergencyReset: false,
        };
      }

      case 'decelerating': {
        this.phaseTimer -= delta;

        const shouldInitLoop = !this.initialHandoffCompleted;
        if (shouldInitLoop) {
          this.initialHandoffCompleted = true;
        }

        if (this.phaseTimer <= 0) {
          this.currentPhase = 'idle';
          return {
            triggerLoaderReveal: 'none',
            triggerExitBurst: false,
            triggerFastSpinLoopInit: shouldInitLoop,
            updateInterfaceVisibility: true,
            setInteractiveTimescale: 1.0,
            triggerEmergencyReset: false,
          };
        }

        return {
          triggerLoaderReveal: 'none',
          triggerExitBurst: false,
          triggerFastSpinLoopInit: shouldInitLoop,
          updateInterfaceVisibility: null,
          setInteractiveTimescale: null,
          triggerEmergencyReset: false,
        };
      }

      case 'idle': {
        const targetTimescale = isQueryActive ? 4.5 : 1.0;
        return {
          triggerLoaderReveal: 'none',
          triggerExitBurst: false,
          triggerFastSpinLoopInit: false,
          updateInterfaceVisibility: null,
          setInteractiveTimescale: targetTimescale,
          triggerEmergencyReset: false,
        };
      }
    }
  }

  public notifyExitBurstComplete(): void {
    if (this.currentPhase === 'burstIsolation') {
      this.currentPhase = 'decelerating';
      this.phaseTimer = 0.5;
      this.initialHandoffCompleted = false;
    }
  }

  // Diagnostic method purely for test safety guardrails
  public getPhase(): VisualPhase {
    return this.currentPhase;
  }
}
