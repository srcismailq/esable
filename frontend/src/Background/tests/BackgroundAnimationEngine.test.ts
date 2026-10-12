import { describe, it, expect, beforeEach } from 'vitest';
import { BackgroundAnimationEngine } from '../services/BackgroundAnimationEngine';
import { ANIMATION_CONFIG } from '../config/animationConfig';

// Mocked configurations matching our global ledger constants
const MILESTONES = { CUBE: 25, HELIX: 50, TORUS: 75 };
const STANDARD_FRAME = 0.016; // 60fps frame delta

describe('BackgroundAnimationEngine Guardrail Specs', () => {
  let engine: BackgroundAnimationEngine;

  beforeEach(() => {
    // Arrange: Ensure complete isolation between tests with a fresh instance
    engine = new BackgroundAnimationEngine();
  });

  describe('Phase 0: The Asynchronous Loading Sequence', () => {
    it('should enforce an explicit system lockout while progress is zero', () => {
      // Arrange
      const input = {
        delta: STANDARD_FRAME,
        progress: 0,
        isQueryActive: false,
        loadersWereVisible: false,
      };

      // Act
      const commands = engine.update(input);

      // Assert
      expect(commands.updateInterfaceVisibility).toBe(false);
      expect(commands.triggerLoaderReveal).toBe('none');
    });

    it('should sequentially emit reveal commands as progress passes milestone flags', () => {
      // Arrange & Act 1: Progress hits the first milestone threshold precisely
      const commandsCube = engine.update({
        delta: STANDARD_FRAME,
        progress: ANIMATION_CONFIG.MILESTONES.CUBE, 
        isQueryActive: false,
        loadersWereVisible: true,
      });

      // Assert 1
      expect(commandsCube.triggerLoaderReveal).toBe('cube');

      // Arrange & Act 2: Progress advances to hit the helix milestone precisely
      const commandsHelix = engine.update({
        delta: STANDARD_FRAME,
        progress: ANIMATION_CONFIG.MILESTONES.HELIX, 
        isQueryActive: false,
        loadersWereVisible: true,
      });

      // Assert 2
      expect(commandsHelix.triggerLoaderReveal).toBe('helix');
    });

    it('should completely suppress duplicate reveal commands on subsequent frames', () => {
      // Arrange: Advance to milestone and capture initial fire
      engine.update({
        delta: STANDARD_FRAME,
        progress: ANIMATION_CONFIG.MILESTONES.CUBE,
        isQueryActive: false,
        loadersWereVisible: true,
      });

      // Act: Tick a second frame at the exact same progress level
      const consecutiveCommands = engine.update({
        delta: STANDARD_FRAME,
        progress: ANIMATION_CONFIG.MILESTONES.CUBE,
        isQueryActive: false,
        loadersWereVisible: true,
      });

      // Assert: Verify animation does not double-trigger
      expect(consecutiveCommands.triggerLoaderReveal).toBe('none');
    });
  });

  describe('Phase 1 & 2: The Boot Blast & Isolation Windows', () => {
    it('should fire the exit burst timeline the exact frame progress hits 100 if loaders were visible', () => {
      // Arrange
      const input = {
        delta: STANDARD_FRAME,
        progress: 100,
        isQueryActive: false,
        loadersWereVisible: true,
      };

      // Act
      const commands = engine.update(input);

      // Assert: Linear burst explosion is commanded, dashboard stays completely hidden
      expect(commands.triggerExitBurst).toBe(true);
      expect(commands.updateInterfaceVisibility).toBeNull();
    });

    it('should signal high-velocity ambient loop initialization once visual burst completes', () => {
      // Arrange: Move engine past Phase 1 trigger point
      engine.update({ delta: STANDARD_FRAME, progress: 100, isQueryActive: false, loadersWereVisible: true });
      
      // Act: Emulate the view layer's GSAP onComplete bridge handoff callback explicitly
      engine.notifyExitBurstComplete();
      const commands = engine.update({ delta: STANDARD_FRAME, progress: 100, isQueryActive: false, loadersWereVisible: true });

      // Assert: The high velocity velocity tracking loops must fire natively on frame zero
      expect(commands.triggerFastSpinLoopInit).toBe(true);
    });

    it('should strictly withhold the dashboard UI reveal command while isolated spin countdown runs', () => {
      // Arrange: Drive the engine into the isolated countdown state matrix
      engine.update({ delta: STANDARD_FRAME, progress: 100, isQueryActive: false, loadersWereVisible: true });
      engine.notifyExitBurstComplete();

      // Act: Tick forward by an amount less than the configured 0.5s threshold (e.g. 0.2s)
      const commands = engine.update({ delta: 0.2, progress: 100, isQueryActive: false, loadersWereVisible: true });

      // Assert: The interface container visibility remains completely empty/nullified
      expect(commands.updateInterfaceVisibility).toBeNull();
    });
  });

  describe('Phase 3 & 4: Interface Handoff & Processing Lifecycles', () => {
    it('should command interface visibility and rest timescale targets the frame isolation expires', () => {
      // Arrange: Drive into isolated matrix countdown, then exhaust 0.3s of the 0.5s window
      engine.update({ delta: STANDARD_FRAME, progress: 100, isQueryActive: false, loadersWereVisible: true });
      engine.notifyExitBurstComplete();
      engine.update({ delta: 0.3, progress: 100, isQueryActive: false, loadersWereVisible: true });

      // Act: Cross the remaining threshold by ticking another 0.3s (Cumulative 0.6s / 0.5s target)
      const commands = engine.update({ delta: 0.3, progress: 100, isQueryActive: false, loadersWereVisible: true });

      // Assert: The dashboard gate immediately reveals, and standard tempo deceleration begins
      expect(commands.updateInterfaceVisibility).toBe(true);
      expect(commands.setInteractiveTimescale).toBe(1.0);
    });

    it('should command an accelerated target velocity timescale when user queries become active', () => {
      // Arrange: Establish a fully settled, operational workspace resting state
      engine.update({ delta: STANDARD_FRAME, progress: 100, isQueryActive: false, loadersWereVisible: true });
      engine.notifyExitBurstComplete();
      engine.update({ delta: 0.6, progress: 100, isQueryActive: false, loadersWereVisible: true }); // Clear window

      // Act: Fire an update reporting a live background infrastructure request cycle
      const commands = engine.update({ delta: STANDARD_FRAME, progress: 100, isQueryActive: true, loadersWereVisible: true });

      // Assert: Processing velocity scale factor emitted
      expect(commands.setInteractiveTimescale).toBe(4.5);
    });

    it('should command velocity recovery back to baseline when active query cycles resolve', () => {
      // Arrange: Transition into active processing tempo state
      engine.update({ delta: STANDARD_FRAME, progress: 100, isQueryActive: false, loadersWereVisible: true });
      engine.notifyExitBurstComplete();
      engine.update({ delta: 0.6, progress: 100, isQueryActive: false, loadersWereVisible: true });
      engine.update({ delta: STANDARD_FRAME, progress: 100, isQueryActive: true, loadersWereVisible: true });

      // Act: Drop the query state matrix back down to inactive baseline configurations
      const commands = engine.update({ delta: STANDARD_FRAME, progress: 100, isQueryActive: false, loadersWereVisible: true });

      // Assert: Eases structural speed back down to resting tempo values
      expect(commands.setInteractiveTimescale).toBe(1.0);
    });
  });

  describe('Phase 5: The Emergency Shields (Reload Protection)', () => {
    it('should immediately command a full system UI lockout if loading metrics drop below 100%', () => {
      // Arrange: Run engine all the way down into standard idle operational cycles
      engine.update({ delta: STANDARD_FRAME, progress: 100, isQueryActive: false, loadersWereVisible: true });
      engine.notifyExitBurstComplete();
      engine.update({ delta: 0.6, progress: 100, isQueryActive: false, loadersWereVisible: true });

      // Act: Simulate a hard network pipeline drop or manual infrastructure reset frame
      const commands = engine.update({ delta: STANDARD_FRAME, progress: 0, isQueryActive: false, loadersWereVisible: true });

      // Assert: Lock screen shields reactivate instantly
      expect(commands.updateInterfaceVisibility).toBe(false);
    });

    it('should fast-forward straight to idle operational modes if application loads with invisible loaders', () => {
      // Arrange & Act: First tick arrives instantly at 100% progress without loading views ever being visible
      const commands = engine.update({
        delta: STANDARD_FRAME,
        progress: 100,
        isQueryActive: false,
        loadersWereVisible: false,
      });

      // Assert: Skip explosion sequences, pop open dashboard, lock timescale directly to resting baseline
      expect(commands.triggerExitBurst).toBe(false);
      expect(commands.updateInterfaceVisibility).toBe(true);
      expect(commands.setInteractiveTimescale).toBe(1.0);
    });
  });
});
