import { defineConfig } from 'vitest/config';

export default defineConfig({
  // base relativa: funciona no GitHub Pages com qualquer nome de repositório.
  base: './',
  build: { target: 'es2022', outDir: 'dist' },
  test: { include: ['tests/**/*.test.ts'] },
});
