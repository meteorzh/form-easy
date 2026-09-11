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

将表单 schema 通过 `element.schema = schema` 传入即可渲染。支持基础、对象与数组字段，以及事件订阅、字段绑定、默认值和预设值加载。schema 可以通过 `definitions` 保存可复用字段模板，并在字段或数组元素位置使用 `{ $ref: '定义名' }` 声明递归结构。未传 `eventCenter` 的表单会共用 `globalEventCenter`；也可自行创建 `new EventCenter()` 并传入表单以隔离事件。

字段可通过 `componentData` 直接提供下拉选项等组件数据，或通过 `componentDataKey` 配合 `ComponentDataManager` 异步加载。数据就绪后，组件才会挂载并接收字段值。`componentDataKey` 也支持 `city-options(provinceCode:./provinceCode)` 参数表达式；框架通过表单级 `FormValueStore` 读取并订阅引用字段，将最新值传入 resolver 的 `params` 参数。

核心会预注册 `select` 组件。配置 `component: 'select'` 后，传入形如 `{ label, value, disabled? }[]` 的 `componentData` 即可使用原生 H5 下拉框。

字段通过 `required` 配置必填，通过 `rules` 配置 `minLength`、`maxLength`、`min`、`max`、`pattern` 和 `enum` 同步校验；表单元素提供 `validate()` 与 `validateField(fieldId)` 方法。

`ComponentDataResolver` 接收 `(context, params)` 两个参数；`ComponentDataManager.resolve()` 的第三个参数可传入只读的命名参数对象，省略时使用空对象。

渲染服务端或其他外部来源的 JSON 前，可使用 `validateFormSchema(schema)` 深度校验表单、递归字段、分类专属属性、默认值、rules、binds 和事件订阅。返回结果包含 `valid`、`issues`、`errors` 与 `warnings`，每个问题都提供稳定 `code`、JSON 风格 `path` 和中文 `message`。

完整使用文档、Vue 3 与 Element Plus 示例请参阅 [项目主页](https://github.com/meteorzh/form-easy#readme)。

核心包还提供由动态表单 JSON 驱动的 `<form-easy-creator>` 可视化设计器，可实时生成并校验表单 schema；设计器能够维护 `definitions`，并通过不展开目标定义的 `$ref` 节点安全设计递归表单。

## License

Apache-2.0
