# form-easy-vue 💚

`form-easy` 的 Vue 3 渲染器与 UI 组件库适配工具。

```bash
npm install form-easy form-easy-vue vue
```

```ts
import { createVueBasicFieldRenderer } from 'form-easy-vue';

const renderer = createVueBasicFieldRenderer();
renderer.registerFieldComponent('myInput', MyInput);
```

```vue
<form-easy :schema.prop="schema" :basicFieldRenderer.prop="renderer" />
```

Element Plus 渲染器通过 `form-easy-vue/element-plus` 独立入口提供。请由使用者安装 Element Plus 并引入样式，然后直接调用 `getDefaultElementPlusBasicFieldRenderer()`；常用组件已在该默认实例中完成注册。

完整 API 与 Element Plus 配置示例请参阅 [项目主页](https://github.com/meteorzh/form-easy#readme)。

## License

Apache-2.0
