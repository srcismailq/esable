import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Commands Vitest to simulate a browser environment in terminal memory
    environment: 'jsdom',
    // Exposes global test keywords (describe, it, expect) natively
    globals: true,
    // Explicitly scopes tests to your dedicated top-level folder boundary
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
})