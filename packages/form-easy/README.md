# @wenzhencn/form-easy ✨

JSON 驱动的动态表单 Web Components，基于 Stencil 构建。

```bash
npm install @wenzhencn/form-easy
```

```ts
import { defineCustomElements } from '@wenzhencn/form-easy/loader';

defineCustomElements();
```

```html
<form-easy></form-easy>
```

将表单 schema 通过 `element.schema = schema` 传入即可渲染。支持基础、对象与数组字段，以及事件订阅、字段绑定、默认值和预设值加载。未传 `eventCenter` 的表单会共用 `globalEventCenter`；也可自行创建 `new EventCenter()` 并传入表单以隔离事件。

字段可通过 `componentData` 直接提供下拉选项等组件数据，或通过 `componentDataKey` 配合 `ComponentDataManager` 异步加载。数据就绪后，组件才会挂载并接收字段值。

核心会预注册 `select` 组件。配置 `component: 'select'` 后，传入形如 `{ label, value, disabled? }[]` 的 `componentData` 即可使用原生 H5 下拉框。

完整使用文档、Vue 3 与 Element Plus 示例请参阅 [项目主页](https://github.com/meteorzh/form-easy#readme)。

## License

Apache-2.0
