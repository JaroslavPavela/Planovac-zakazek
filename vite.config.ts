import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vícesouborový build do dist/ + konfigurace Vitest.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
