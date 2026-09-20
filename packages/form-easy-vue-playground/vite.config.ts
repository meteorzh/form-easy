import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/** Playground 使用 form-easy-vue 的 Vue 包装组件，无需配置自定义元素识别。 */
export default defineConfig({
  plugins: [vue()]
});
