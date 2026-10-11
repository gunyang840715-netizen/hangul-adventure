import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// 앱 버전 표시: 자동 빌드(GitHub Actions)는 BUILD_ID를 넣고, 아니면 만든 시각(한국 시간)
const stamp = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
export default defineConfig({
  plugins: [
    // 기기 연동 공용 파일은 서버용 CommonJS 그대로 보존. 개발 화면에서만 ESM 연결.
    { name: 'shared-merge-dev', apply: 'serve', transform(code, id) {
      if (id.replace(/\\/g, '/').endsWith('/shared/merge.js')) return code + '\nexport { mergeState, sumMap };\n';
    } },
    preact(), viteSingleFile(),
  ],
  define: { __BUILD__: JSON.stringify(process.env.BUILD_ID || stamp) },
  build: { target: 'es2019', assetsInlineLimit: 100000000, cssCodeSplit: false },
});
