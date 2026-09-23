# @wenzhencn/form-easy-vue 💚

`form-easy` 的 Vue 3 渲染器与 UI 组件库适配工具。

```bash
npm install @wenzhencn/form-easy @wenzhencn/form-easy-vue vue
```

```ts
import { createVueBasicFieldRenderer } from '@wenzhencn/form-easy-vue';

const renderer = createVueBasicFieldRenderer();
renderer.registerFieldComponent('myInput', MyInput);
```

未显式配置 `component` 的基础字段会按数据类型查找 `input`、`input-number`、`bool`、`date`、`datetime` 或 `time` 组件；未注册时才回退到原生 H5 控件。`select` 与任意业务自定义组件键也可通过 `component` 显式指定。

Vue 项目推荐使用 `FormEasy` 包装组件。它会自动注册底层 Web Component，用户不需要在
`vite.config.ts` 中配置 `isCustomElement`，也不需要手动调用 `defineCustomElements()`：

```vue
<script setup lang="ts">
import { FormEasy } from '@wenzhencn/form-easy-vue';
</script>

<template>
  <FormEasy :schema="schema" :basic-field-renderer="renderer" />
</template>
```

设计器使用 `FormEasyCreator`：

```ts
import { FormEasy, FormEasyCreator, installFormEasyVue } from '@wenzhencn/form-easy-vue';

app.use(installFormEasyVue);
```

两个包装组件只负责 Vue props、事件和 `v-model` 适配；字段循环、数组、对象、record、
校验及事件管理仍由 `form-easy` 核心组件完成。

自定义字段组件推荐使用 `useFormEasyField()`，它统一提供受控值、禁用状态、字段上下文与端点调用能力。组件仍需使用 `update:modelValue` 回传值；`componentProperties` 会透传为组件属性。完整示例和注意事项请参阅项目主页的「编写 Vue 3 自定义字段组件」章节。

Element Plus 渲染器通过 `@wenzhencn/form-easy-vue/element-plus` 独立入口提供。请由使用者安装 Element Plus、安装插件并引入样式，然后调用 `getDefaultElementPlusBasicFieldRenderer()`；常用字段组件已在该默认实例中完成注册。

```ts
import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';

createApp(App).use(ElementPlus).mount('#app');
```

Vue 默认渲染器与 Element Plus 渲染器均支持 `component: 'upload'`。请在核心包中通过 `EndpointManager` 注册 `upload` 端点；单文件写入 URL 字符串，多文件写入 URL 数组的 JSON 字符串。

完整 API 与 Element Plus 配置示例请参阅 [项目主页](https://github.com/meteorzh/form-easy#readme)。

## License

Apache-2.0
