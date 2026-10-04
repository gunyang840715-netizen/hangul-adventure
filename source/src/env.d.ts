declare module '*.css';
declare module '*?raw' { const s: string; export default s; }
/** 앱을 만든 때·번호 (vite.config.ts에서 넣음) — 부모 설정에 보임 */
declare const __BUILD__: string;
