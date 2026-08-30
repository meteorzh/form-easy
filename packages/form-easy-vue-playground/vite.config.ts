import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/** Vite 配置：将 form-easy 系列标签识别为原生自定义元素。 */
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => tag.startsWith('form-easy')
        }
      }
    })
  ]
});
