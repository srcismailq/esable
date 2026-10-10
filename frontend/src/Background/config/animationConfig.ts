// src/Background/config/animationConfig.ts

export const ANIMATION_CONFIG = {
  SCALES: {
    LOADER_MAX: 1,
    CENTER_CUBE_BASELINE: 60,
    CENTER_CUBE_PROCESSING: 75,
  },
  DURATIONS: {
    EXIT_BRIDGE: 1.2,
    PROCESSING_TWEEN: 0.4,
  },
  COLORS: {
    TARGET_BACKGROUND: '#ed8529',
  },
  MILESTONES: {
    CUBE: 5,
    HELIX: 30,
    TORUS: 75,
  },
} as const;
