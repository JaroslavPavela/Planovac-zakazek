import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { renameSync } from 'node:fs';
import { resolve } from 'node:path';

const VYSTUPNI_SLOZKA = 'dist-single';
const NAZEV_SOUBORU = 'planovani-zakazek.html';

/** Po buildu přejmenuje index.html na planovani-zakazek.html. */
function prejmenujVystup(): Plugin {
  return {
    name: 'prejmenuj-vystup',
    closeBundle() {
      renameSync(
        resolve(VYSTUPNI_SLOZKA, 'index.html'),
        resolve(VYSTUPNI_SLOZKA, NAZEV_SOUBORU),
      );
    },
  };
}

// Jednosouborový build: dist-single/planovani-zakazek.html (inline JS i CSS, běží z file://).
export default defineConfig({
  plugins: [react(), viteSingleFile(), prejmenujVystup()],
  base: './',
  build: {
    outDir: VYSTUPNI_SLOZKA,
    emptyOutDir: true,
  },
});
