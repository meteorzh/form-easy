# @wenzhencn/form-easy ✨

JSON 驱动的动态表单 Web Components，基于 Stencil 构建。

```bash
npm install @wenzhencn/form-easy
```

```ts
import { defineCustomElements } from '@wenzhencn/form-easy/loader';

defineCustomElements();
```

该包的 lazy `dist` 构建已启用 Stencil 的 `enableImportInjection`，会将组件懒加载路径注入为 bundler 可分析的静态分支；使用 Vite、Parcel 等 bundler 时，构建产物应包含对应的 `.entry.js` 文件。

```html
<form-easy></form-easy>
```

将表单 schema 通过 `element.schema = schema` 传入即可渲染。支持基础、对象、数组与动态键值 `record` 字段，以及事件订阅、字段绑定、默认值和预设值加载。`record` 通过 `kvDef.key` 配置固定字符串 key 的编辑能力，通过 `kvDef.value` 声明所有动态 value 共用的匿名字段定义。schema 可以通过 `definitions` 保存可复用字段模板，并在字段、数组元素或 Record value 位置使用 `{ $ref: '定义名' }` 声明递归结构。未传 `eventCenter` 的表单会共用 `globalEventCenter`；也可自行创建 `new EventCenter()` 并传入表单以隔离事件。

字段可通过 `componentData` 直接提供下拉选项等组件数据，或通过 `componentDataKey` 配合 `ComponentDataManager` 异步加载。数据就绪后，组件才会挂载并接收字段值。`componentDataKey` 也支持 `city-options(provinceCode:./provinceCode)` 参数表达式；框架通过表单级 `FormValueStore` 读取并订阅引用字段，将最新值传入 resolver 的 `params` 参数。

字段提示支持 `hints` 列表。提示位置可以是 `aboveLabel`、`belowLabel`、`aboveControl` 或 `belowControl`，触发器支持 `static`、`hover` 和 `click`，每个位置最多配置一条。旧版 `hint` 字符串仍兼容，并按 `belowLabel + static` 处理。

核心会预注册 `select` 组件。配置 `component: 'select'` 后，传入形如 `{ label, value, disabled? }[]` 的 `componentData` 即可使用原生 H5 下拉框。

字段通过 `required` 配置必填，通过 `rules` 配置 `minLength`、`maxLength`、`min`、`max`、`pattern` 和 `enum` 同步校验；表单元素提供 `validate()` 与 `validateField(fieldId)` 方法。

首次挂载以及替换 `schema` 或 `value` 时，表单会进入 loading 状态，用半透明蒙层遮住表单内容，直到嵌套字段全部挂载完成后再移出蒙层。开始加载时发出 `formLoading` 事件，加载结束时发出 `formReady` 事件，两者成对出现，载荷均为 `{ formKey }`。

loading 期间字段逐层挂载产生的值变化不会逐条发出 `formChange`。加载会规范化传入的值：补齐缺失字段、套用默认值、去掉 schema 之外的属性，并按 optional、隐藏和 `omitNull` 策略过滤输出，初始化联动也可能改写字段。无论加载由首次挂载、`schema` 还是 `value` 触发，结束后只要实际生效的数据与传入的 `value` 不同，就会在 `formReady` 之后补发一次 `formChange`（`fieldId` 为表单 key，`value` 与 `formData` 均为完整数据）；没有变化则不发。设计器同理：载入结果与传入的 schema 不同（例如匿名模式生成了默认 key）时发出一次 `schemaChange`。

`schema` 表示表单结构，`value` 表示对应的填充值。表单只有结构稳定后才能接受填充值，因此 loading 期间调用方不能修改 `schema` 或 `value`：一旦修改会在控制台记录错误并忽略该次修改，表单结构始终保持稳定。收到 `formReady` 时表单已经完全空闲，调用方可以在其中立即设置新的 `schema` 或 `value`；替换 `schema` 后应等 `formReady` 再设置填充值。

loading 蒙层会先绘制出来，再开始载入数据，数据落地后蒙层再淡出。提示文字固定在视口中央，表单比视口高时也不会跑到屏幕外。

拥有 `key` 的命名字段可配置 `optional: true`。用户可以在字段 label 区域控制该属性是否存在于最终输出；未设置时 label 显示删除线并隐藏真实值控件。存在状态独立于字段值，因此属性不存在与属性明确等于 `null` 可以被准确区分。未设置的 optional 字段跳过值校验。

字段绑定通过一个 target、一个命名 `params` 对象和可选 resolver 描述完整计算关系。单参数绑定可以省略 resolver；多参数必须配置 resolver，例如 `{ target: 'visible', params: { category: './category', reference: './$ref' }, resolver: "return category === 'basic' || reference !== null;" }`。同一字段的同一个 target 只能配置一次。跨表单完整字段引用需要相关表单共用同一个 `FormValueStore` 和 `EventCenter`。

拥有 `key` 的顶层字段或对象子字段可配置 `omitNull: true`。字段的 null 状态、初始化事件、校验和 `FormValueStore` 不受影响，仅在父级对外输出对象中省略该属性。第一阶段不支持在 definitions 模板、数组匿名元素或 Record 匿名 value 定义中使用此配置。

命名字段还支持 `omitWhenHidden: true`。字段隐藏后仅从对外表单数据中省略，内部值和 `FormValueStore` 保持不变；重新显示时会恢复输出。该配置同样不允许用于 definitions 模板、数组匿名元素或 Record 匿名 value。

`ComponentDataResolver` 接收 `(context, params)` 两个参数；`ComponentDataManager.resolve()` 的第三个参数可传入只读的命名参数对象，省略时使用空对象。管理器会按 `componentDataKey + params` 缓存成功结果；调用 `register()` 替换 resolver 时会清理该 key 的缓存，也可以通过 `clearCache()` 主动清理。

渲染服务端或其他外部来源的 JSON 前，可使用 `validateFormSchema(schema)` 深度校验表单、递归字段、分类专属属性、默认值、rules、binds 和事件订阅。返回结果包含 `valid`、`issues`、`errors` 与 `warnings`，每个问题都提供稳定 `code`、JSON 风格 `path` 和中文 `message`。

完整使用文档、Vue 3 与 Element Plus 示例请参阅 [项目主页](https://github.com/meteorzh/form-easy#readme)。

核心包还提供由动态表单 JSON 驱动的 `<form-easy-creator>` 可视化设计器，可实时生成并校验表单 schema；设计器能够维护 `definitions`，字段直接通过同级、可清空的 `$ref` 选择器切换内联与引用配置，并可安全设计递归表单。

## License

Apache-2.0
