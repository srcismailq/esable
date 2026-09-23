import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 1. Keeps tests fast by running in pure Node.js (no slow browser engine simulation)
    environment: 'node',
    
    // 2. Exposes global test keywords (describe, it, expect) so you don't always have to import them
    globals: true,
    
    // 3. Targets your test folder relative to the root execution context
    include: ['setup/tests/**/*.{test,spec}.{ts,tsx,js,jsx}'],
  },
});
