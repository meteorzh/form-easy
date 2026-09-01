import { createApp } from 'vue';
import App from './App.vue';
import {
  registerGlobalComponentDataResolver
} from 'form-easy';
import { defineCustomElements } from 'form-easy/loader';
import 'element-plus/dist/index.css';

/** 为 Playground 示例提供按数据键加载的下拉选项。 */
registerGlobalComponentDataResolver(async ({ componentDataKey, signal }) => {
  if (componentDataKey !== 'playground-status-options') {
    throw new Error(`未找到 Playground 组件数据：${componentDataKey}`);
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(resolve, 300);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timeoutId);
      reject(new DOMException('组件数据请求已取消。', 'AbortError'));
    }, { once: true });
  });

  return [
    { label: '草稿', value: 'draft' },
    { label: '已启用', value: 'enabled' },
    { label: '已停用', value: 'disabled', disabled: true }
  ];
});

defineCustomElements();
createApp(App).mount('#app');
