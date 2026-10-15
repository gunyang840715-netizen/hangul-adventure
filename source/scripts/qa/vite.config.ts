import { mergeConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import base from '../../vite.config';
export default mergeConfig(base, {
  build: { outDir: process.env.HANGUL_QA_OUT || 'dist-qa', rollupOptions: { input: fileURLToPath(new URL(process.env.HANGUL_QA_PAGE === 'parent' ? './parent.html' : process.env.HANGUL_QA_PAGE === 'side' ? './side.html' : './runner.html', import.meta.url)) } },
});
