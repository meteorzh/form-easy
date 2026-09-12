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

将表单 schema 通过 `element.schema = schema` 传入即可渲染。支持基础、对象、数组与动态键值 `record` 字段，以及事件订阅、字段绑定、默认值和预设值加载。`record` 通过 `kvDef.key` 配置固定字符串 key 的编辑能力，通过 `kvDef.value` 声明所有动态 value 共用的匿名字段定义。schema 可以通过 `definitions` 保存可复用字段模板，并在字段、数组元素或 Record value 位置使用 `{ $ref: '定义名' }` 声明递归结构。未传 `eventCenter` 的表单会共用 `globalEventCenter`；也可自行创建 `new EventCenter()` 并传入表单以隔离事件。

字段可通过 `componentData` 直接提供下拉选项等组件数据，或通过 `componentDataKey` 配合 `ComponentDataManager` 异步加载。数据就绪后，组件才会挂载并接收字段值。`componentDataKey` 也支持 `city-options(provinceCode:./provinceCode)` 参数表达式；框架通过表单级 `FormValueStore` 读取并订阅引用字段，将最新值传入 resolver 的 `params` 参数。

核心会预注册 `select` 组件。配置 `component: 'select'` 后，传入形如 `{ label, value, disabled? }[]` 的 `componentData` 即可使用原生 H5 下拉框。

字段通过 `required` 配置必填，通过 `rules` 配置 `minLength`、`maxLength`、`min`、`max`、`pattern` 和 `enum` 同步校验；表单元素提供 `validate()` 与 `validateField(fieldId)` 方法。

拥有 `key` 的命名字段可配置 `optional: true`。用户可以在字段 label 区域控制该属性是否存在于最终输出；未设置时 label 显示删除线并隐藏真实值控件。存在状态独立于字段值，因此属性不存在与属性明确等于 `null` 可以被准确区分。未设置的 optional 字段跳过值校验。

同一字段存在多个相同的 `visible` 或 `enable` 绑定目标时，可使用 `combine: 'and' | 'or'` 选择全部满足或任一满足，默认使用 `and`。同一目标的组合方式必须一致，`value` 目标仍然只允许配置一个绑定源。

拥有 `key` 的顶层字段或对象子字段可配置 `omitNull: true`。字段的 null 状态、初始化事件、校验和 `FormValueStore` 不受影响，仅在父级对外输出对象中省略该属性。第一阶段不支持在 definitions 模板、数组匿名元素或 Record 匿名 value 定义中使用此配置。

命名字段还支持 `omitWhenHidden: true`。字段隐藏后仅从对外表单数据中省略，内部值和 `FormValueStore` 保持不变；重新显示时会恢复输出。该配置同样不允许用于 definitions 模板、数组匿名元素或 Record 匿名 value。

`ComponentDataResolver` 接收 `(context, params)` 两个参数；`ComponentDataManager.resolve()` 的第三个参数可传入只读的命名参数对象，省略时使用空对象。

渲染服务端或其他外部来源的 JSON 前，可使用 `validateFormSchema(schema)` 深度校验表单、递归字段、分类专属属性、默认值、rules、binds 和事件订阅。返回结果包含 `valid`、`issues`、`errors` 与 `warnings`，每个问题都提供稳定 `code`、JSON 风格 `path` 和中文 `message`。

完整使用文档、Vue 3 与 Element Plus 示例请参阅 [项目主页](https://github.com/meteorzh/form-easy#readme)。

核心包还提供由动态表单 JSON 驱动的 `<form-easy-creator>` 可视化设计器，可实时生成并校验表单 schema；设计器能够维护 `definitions`，字段直接通过同级、可清空的 `$ref` 选择器切换内联与引用配置，并可安全设计递归表单。

## License

Apache-2.0
