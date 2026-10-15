import { mergeConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import base from '../../vite.config';
export default mergeConfig(base, {
  build: { outDir: process.env.HANGUL_QA_OUT || 'dist-qa', rollupOptions: { input: fileURLToPath(new URL('./runner.html', import.meta.url)) } },
});
