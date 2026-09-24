# form-easy ✨

**一个由 JSON 驱动的动态表单组件库。** `form-easy` 使用 Stencil 构建为标准 Web Components，可在任意前端项目中使用；`form-easy-vue` 则提供 Vue 3 渲染器、独立组件注册中心以及 Element Plus 适配工厂。

> 🧩 一份 schema，按需选择原生 H5、Vue 或第三方 UI 库渲染器。

## 特性 🚀

- 📝 支持字符串、数字、布尔、日期、日期时间和时间基础字段。
- 🌳 支持对象字段与可增删的数组字段，并自动递归渲染。
- ♻️ 支持通过 `definitions` 与 `$ref` 声明可复用及递归字段结构。
- 🎛️ 支持默认值与预设值加载；初始化会统一触发字段 `onChange`。
- 🔗 支持字段事件订阅、`visible` / `enable` / `value` 绑定及自定义 resolver。
- 🔄 内置事件流循环检测，避免订阅配置意外形成无限循环。
- 🎨 支持表单级渲染器，默认 H5、Vue 与 Element Plus 实例可同时存在。
- 📐 支持 `left`、`top`、`right` 三种标签位置。
- 🧰 内置由动态表单 JSON 驱动的可视化 schema 设计器。

## 包说明 📦

| 包 | 用途 | 是否发布 |
| --- | --- | --- |
| [`@wenzhencn/form-easy`](./packages/form-easy) | 核心 Web Components、schema 类型、事件与默认 H5 渲染 | ✅ |
| [`@wenzhencn/form-easy-vue`](./packages/form-easy-vue) | Vue 3 渲染器与 Element Plus 适配工厂 | ✅ |
| [`form-easy-vue-playground`](./packages/form-easy-vue-playground) | 本地交互式示例 | ❌ |

## 安装 💿

### 原生 H5 / 任意框架

```bash
npm install @wenzhencn/form-easy
```

### Vue 3

```bash
npm install @wenzhencn/form-easy @wenzhencn/form-easy-vue vue
```

Vue 项目推荐使用 `form-easy-vue` 提供的 `FormEasy` 和 `FormEasyCreator` 包装组件。
它们会自动注册底层 Web Components，因此不需要配置 Vite 的 `isCustomElement`，
也不需要在应用入口手动调用 `defineCustomElements()`。

### Vue 3 + Element Plus

`form-easy-vue` 不会安装或打包 Element Plus。请由业务项目自行选择版本、安装组件库与引入样式：

```bash
npm install @wenzhencn/form-easy @wenzhencn/form-easy-vue vue element-plus
```

## 快速开始 ⚡

### 1. 注册 Web Components

在应用启动入口注册一次即可：

```ts
import { defineCustomElements } from '@wenzhencn/form-easy/loader';

defineCustomElements();
```

### 2. 编写 schema 并渲染

```ts
const schema = {
  key: 'profile',
  name: '个人资料',
  labelPosition: 'left',
  fields: [
    {
      key: 'nickname',
      name: '昵称',
      category: 'basic',
      dataType: 'string',
      required: true,
      defaultValue: 'form-easy'
    },
    {
      key: 'enabled',
      name: '启用状态',
      category: 'basic',
      dataType: 'boolean',
      defaultValue: true
    }
  ]
};

const form = document.querySelector('form-easy');
form.schema = schema;
form.addEventListener('formChange', event => {
  console.log(event.detail);
});
```

```html
<form-easy></form-easy>
```

## 可复用与递归字段定义 ♻️

`definitions` 可以保存不含实例 `key` 和 `name` 的字段模板，`$ref` 在顶层字段、对象子字段或数组元素位置按需引用模板。引用只在实际渲染到当前层级时展开，因此树形数据、条件组和嵌套流程等递归结构不会在初始化时无限展开。

```ts
const recursiveSchema = {
  key: 'categoryTree',
  name: '分类树',
  definitions: {
    categoryNode: {
      category: 'object',
      fields: [
        {
          key: 'name',
          name: '分类名称',
          category: 'basic',
          dataType: 'string',
          required: true
        },
        {
          key: 'children',
          name: '子分类',
          category: 'array',
          element: { $ref: 'categoryNode' }
        }
      ]
    }
  },
  fields: [
    {
      $ref: 'categoryNode',
      key: 'root',
      name: '根分类'
    }
  ]
};
```

引用实例可以覆盖 `key`、`name`、`required`、`hint`、`defaultValue`、`rules`、绑定和组件数据等实例属性，但字段分类和嵌套结构始终来自模板。`validateFormSchema()` 会检查 definitions 结构与未知 `$ref`。`<form-easy>` 默认最多渲染 32 层，可通过 `maxRenderDepth` 调整保护上限；该限制不会修改原始表单值。

## 可视化表单设计器 🧰

核心包提供 `<form-easy-creator>`。设计器自身仍然是一个 `<form-easy>`：配置界面由独立的 `creator-schema.json` 驱动，编辑结果会实时转换为目标 `FormSchema`，并通过深度 schema 校验器显示错误和警告。

注册 Web Components 后可以直接使用：

```html
<form-easy-creator></form-easy-creator>
```

在 Vue 3 中，可传入已有 schema 继续编辑，并监听实时输出：

```vue
<script setup lang="ts">
import type {
  FormEasyCreatorChangeDetail,
  FormSchema
} from '@wenzhencn/form-easy';
import { FormEasyCreator } from '@wenzhencn/form-easy-vue';

const existingSchema: FormSchema = {
  key: 'profile',
  name: '个人资料',
  fields: []
};

function handleSchemaChange(event: CustomEvent<FormEasyCreatorChangeDetail>) {
  const { schema, validation } = event.detail;
  console.log('当前 schema', schema);
  console.log('是否可用', validation.valid);
}
</script>

<template>
  <FormEasyCreator
    :value="existingSchema"
    :basic-field-renderer="renderer"
    @schema-change="handleSchemaChange"
  />
</template>
```

也可以通过元素方法主动读取和校验：

```ts
const creator = document.querySelector('form-easy-creator');
const schema = await creator.getSchema();
const validation = await creator.getSchemaValidationResult();
const valid = await creator.validate();
```

设计器支持表单基础信息、`definitions`、任意层级字段、校验规则、绑定和事件订阅的可视化配置。数组字段的 `element` 与对象字段的 `fields` 也使用动态表单递归编辑，不需要手写整段 JSON；默认值、组件属性和组件静态数据等任意 JSON 值仍使用专用多行编辑器输入。

字段节点直接通过同级 `$ref` 选择器决定声明方式：不选择时编辑同级内联配置，选择 definition 后只输出 `$ref` 和实例覆盖，不会展开目标定义，因此可以安全表达自引用树结构。清空 `$ref` 会恢复此前保留的内联配置。引用 definitions 的普通字段仍需填写实例 `key` 和 `name`，数组元素引用则不需要。设计器会动态列出当前已声明的 definition，并在定义被删除、改名、重名或引用不存在时通过结构检查给出错误。

设计器右侧可以在 `JSON Schema` 与“表单预览”之间切换。`basicFieldRenderer` 仅用于渲染预览表单；不传时使用默认 H5 渲染器，也可以传入 Vue 或 Element Plus 渲染器。设计器左侧配置区域固定使用隔离的内置 H5 渲染器，确保设计器专用 JSON 编辑组件不要求业务渲染器额外注册。

## Vue 3 使用方式 💚

Vue 模板中直接使用包装组件即可：

```vue
<script setup lang="ts">
import { FormEasy } from '@wenzhencn/form-easy-vue';

const schema = {
  key: 'profile',
  name: '个人资料',
  fields: []
};
</script>

<template>
  <FormEasy v-model="formValue" :schema="schema" />
</template>
```

也可以全局安装两个入口组件：

```ts
import { createApp } from 'vue';
import { installFormEasyVue } from '@wenzhencn/form-easy-vue';

createApp(App).use(installFormEasyVue).mount('#app');
```

`FormEasy` 和 `FormEasyCreator` 只是 Vue 适配层，不会复制一套字段循环逻辑；
字段分类渲染、数组和对象递归、校验、事件中心等仍由核心 Web Component 负责。

### 创建独立 Vue 渲染器

每个 Vue 渲染器都有独立的组件注册中心。适合不同业务表单使用不同组件映射，彼此不会冲突：

```ts
import { createVueBasicFieldRenderer } from '@wenzhencn/form-easy-vue';
import UserNameInput from './UserNameInput.vue';

const userRenderer = createVueBasicFieldRenderer();
userRenderer.registerFieldComponent('userNameInput', UserNameInput);
```

```vue
<FormEasy
  :schema="schema"
  :basic-field-renderer="userRenderer"
/>
```

schema 中配置 `component: 'userNameInput'` 后，渲染器会将 `componentProperties`、`modelValue`、`disabled` 和 `update:modelValue` 事件传递给该 Vue 组件。

Vue 渲染器实例会自动注册默认组件列表；目前包含 `select` 和 `upload`。`select` 使用 `componentData` 渲染原生下拉选项，`upload` 使用 `EndpointManager` 调用上传端点。

### 编写 Vue 3 自定义字段组件 🧩

自定义字段组件应把自己当作一个受控组件：通过 `modelValue` 接收表单值，并在用户操作后发出 `update:modelValue`。这是与动态表单同步值的推荐且完整的约定。

```vue
<!-- UserNameInput.vue -->
<script setup lang="ts">
import {
  useFormEasyField,
  type FormEasyFieldEmits,
  type FormEasyFieldProps
} from '@wenzhencn/form-easy-vue';

const props = defineProps<FormEasyFieldProps & {
  /** schema 的 componentProperties 会透传为同名属性。 */
  placeholder?: string;
}>();

const emit = defineEmits<FormEasyFieldEmits>();

const { value, disabled, fieldId } = useFormEasyField<string>(props, emit);
</script>

<template>
  <input
    v-model="value"
    :disabled="disabled"
    :placeholder="placeholder"
    :aria-label="fieldId"
  />
</template>
```

`useFormEasyField()` 提供 `value`、`updateValue()`、`disabled`、`componentData`、`field`、`fieldId`、`formKey`、`endpointManager` 及 `invokeEndpoint()`。例如需要调用接口的组件可以使用：

```ts
const { invokeEndpoint } = useFormEasyField<File>(props, emit);
const fileUrl = await invokeEndpoint<File, string>('upload', file, abortController.signal);
```

注册组件时建议创建独立渲染器，避免不同业务表单之间的组件映射冲突：

```ts
import { createVueBasicFieldRenderer } from '@wenzhencn/form-easy-vue';
import UserNameInput from './UserNameInput.vue';

const renderer = createVueBasicFieldRenderer();
renderer.registerFieldComponent('userNameInput', UserNameInput);
```

随后在 schema 中明确指定该组件键：

```ts
{
  key: 'userName',
  name: '用户名',
  category: 'basic',
  dataType: 'string',
  component: 'userNameInput',
  componentProperties: {
    placeholder: '请输入用户名'
  }
}
```

注意事项：

- `FormEasyFieldProps` 中的 `modelValue`、`disabled`、`componentData`、`field`、`fieldId`、`formKey` 与 `endpointManager` 是框架上下文；不要在 `componentProperties` 中覆盖它们。
- 业务属性应放在 `componentProperties`，会原样透传给 Vue 组件；请通过 `useFormEasyField()` 返回的 `value` 或 `updateValue()` 回传字段值，避免直接修改 props。
- 配置 `componentDataKey` 时，组件会在数据加载成功后才挂载；自定义组件可直接读取 `componentData`，不应自行重复请求相同数据。
- 需要调用接口时使用框架传入的 `endpointManager`。例如上传组件内部调用固定的 `upload` 端点；不要把 URL、鉴权信息或请求函数写进 schema。
- 显式配置的自定义 `component` 未在当前渲染器注册时，框架会显示“未找到字段组件”错误，不会静默回退为原生输入框。
- `dataType` 仍用于默认组件解析与原生输入值转换；自定义组件应自行保证输出值符合业务期望的类型。

### 使用 Element Plus 渲染器

Element Plus 组件由业务方传入，因此 `form-easy-vue` 不会产生对 Element Plus 的直接依赖：

```ts
import 'element-plus/dist/index.css';
import {
  getDefaultElementPlusBasicFieldRenderer
} from '@wenzhencn/form-easy-vue/element-plus';

const elementRenderer = getDefaultElementPlusBasicFieldRenderer();
```

该独立入口内置并预注册：`input`、`input-number`、`bool`、`date`、`datetime`、`time`、`select` 与 `upload`。当基础字段未配置 `component` 时，渲染器会按 `dataType` 自动使用对应组件；其中 `select` 使用 `ElSelect + ElOption` 渲染 `componentData` 选项，`upload` 使用 `ElUpload` 和 `EndpointManager` 调用上传端点。

```ts
const schema = {
  key: 'settings',
  name: '设置',
  fields: [
    {
      key: 'title',
      name: '标题',
      category: 'basic',
      dataType: 'string',
      componentProperties: { placeholder: '请输入标题' }
    }
  ]
};
```

```vue
<form-easy
  :schema.prop="schema"
  :basicFieldRenderer.prop="elementRenderer"
/>
```

## Schema 指南 🗺️

### Schema 静态校验

在保存、下发或渲染动态表单之前，可以使用 `validateFormSchema()` 对未知 JSON 做完整的静态检查。该方法不会修改 schema，也不会因普通配置错误而抛出异常，而是一次返回全部问题：

```ts
import { validateFormSchema } from '@wenzhencn/form-easy';

const result = validateFormSchema(schemaFromServer);

if (!result.valid) {
  result.errors.forEach(issue => {
    console.error(`[${issue.code}] ${issue.path}: ${issue.message}`);
  });
}

result.warnings.forEach(issue => {
  console.warn(`[${issue.code}] ${issue.path}: ${issue.message}`);
});
```

每一个 `issue` 都包含：

| 属性 | 说明 |
| --- | --- |
| `level` | `error` 或 `warning`；只有 error 会令 `valid` 变为 `false`。 |
| `code` | 适合程序分类处理的稳定问题代码。 |
| `path` | 精确定位问题的 JSON 风格路径，例如 `$.fields[1].rules[0]`。 |
| `message` | 面向开发者的中文错误说明。 |

深度校验覆盖以下内容：

- 表单 `key`、`name`、`fields` 等必需属性、属性类型、未知属性和 `labelPosition` 枚举。
- `definitions` 字段模板、`$ref` 引用及不存在的定义名称。
- 每一级字段的 `key`、`name`、`category`，同级重复 key，以及会破坏完整字段标识的 key 字符。
- 对象字段、数组元素定义、Record 键值定义和嵌套结构，并提供循环引用保护。
- `defaultValue` 与字段分类、`dataType`、对象 fields、数组 element 和 Record value 定义的深度兼容性。
- rules 类型兼容性、必需参数、参数格式、重复规则以及上下界关系。
- binds、eventSubscriptions 的必需属性、枚举、重复配置、resolver 语法和当前表单内的源字段引用。
- `componentData` / `componentDataKey`、`binds` / `eventSubscriptions` 等有覆盖优先级的冲突配置。

字段分类的核心结构约束如下：

| 字段分类 | 必须配置 | 不应配置 |
| --- | --- | --- |
| 基础字段 | `key`、`name`、`category`、`dataType` | `element`、`fields`、`kvDef` |
| 数组字段 | `key`、`name`、`category`、`element` | `dataType`、`component`、`componentData`、`componentDataKey`、`componentProperties`、`fields`、`kvDef` |
| 对象字段 | `key`、`name`、`category`、`fields` | `dataType`、`component`、`componentData`、`componentDataKey`、`componentProperties`、`element`、`kvDef` |
| Record 字段 | `key`、`name`、`category`、`kvDef.key`、`kvDef.value` | `dataType`、`component`、`componentData`、`componentDataKey`、`componentProperties`、`element`、`fields` |
| 匿名字段定义 | `category` 及对应分类必需属性 | `key`、`name` |

同一表单中的绑定和事件源会检查字段定义是否存在；跨表单引用无法仅凭当前 schema 确认，因此只校验其配置格式，不会误报源字段不存在。

### 表单属性

| 属性 | 说明 |
| --- | --- |
| `key` | 表单唯一标识。 |
| `name` | 可选的表单标题；未配置时不渲染标题。 |
| `fields` | 字段配置列表。 |
| `definitions` | 可通过 `$ref` 引用的可复用字段模板。 |
| `labelPosition` | 标签位置：`left`（默认）、`top`、`right`。 |
| `maxRenderDepth` | `<form-easy>` 组件属性，递归字段最大渲染深度，默认 `32`。 |

### 基础字段

```ts
{
  key: 'age',
  name: '年龄',
  category: 'basic',
  dataType: 'number',
  required: true,
  hint: '请输入整数',
  defaultValue: 18,
  componentProperties: { min: 0 }
}
```

`dataType` 可取：`string`、`number`、`boolean`、`date`、`datetime`、`time`。

### Rules 同步校验 ✅

字段通过 `required: true` 声明必填，通过 `rules` 配置按顺序执行的其他同步校验。第一阶段支持 `minLength`、`maxLength`、`min`、`max`、`pattern` 与 `enum`；校验遇到第一个错误后停止，并在字段编辑器下方展示错误信息。

```ts
{
  key: 'userName',
  name: '用户名',
  category: 'basic',
  dataType: 'string',
  required: true,
  rules: [
    { type: 'minLength', value: 3, message: '用户名至少需要 3 个字符。' },
    { type: 'maxLength', value: 20 },
    { type: 'pattern', value: '^[a-zA-Z0-9]+$', message: '只能包含字母和数字。' }
  ]
}
```

`required` 是字段基础配置，不属于 `rules`。必填失败时会使用字段名生成“某某不能为空”的统一提示。空值会跳过其他规则；对象字段只有 `null` 和 `undefined` 属于必填空值，已经创建的空对象 `{}` 可以通过必填校验。`min` / `max` 支持数字、日期、日期时间和 `HH:mm` 时间值，`enum` 的 `value` 应为允许值数组。

不同字段类型支持的规则如下：

| 字段类型 | 支持的规则 |
| --- | --- |
| `string` | `minLength`、`maxLength`、`pattern`、`enum` |
| `number` | `min`、`max`、`enum` |
| `boolean` | `enum` |
| `date` / `datetime` / `time` | `min`、`max`、`enum` |
| 数组字段 | `minLength`、`maxLength` |
| Record 字段 | `minLength`、`maxLength`（动态属性数量） |
| 对象字段 | 暂不支持额外 rules；可使用字段级 `required` |

规则执行前会先校验 schema 配置。若数字字段错误配置了 `pattern`，或者 `enum.value` 不是数组，校验结果的 `errorType` 为 `configuration`；字段会展示明确的配置错误、在控制台输出一次错误，并使 `validate()` 返回 `false`。正常的用户输入错误对应 `errorType: 'value'`。

表单元素提供以下方法：

```ts
const form = document.querySelector('form-easy');

const formValid = await form.validate();
const fieldValid = await form.validateField('profile.userName');
```

初始化和首次输入只计算校验结果，不立即展示普通值错误；字段失焦或调用 `validate()` / `validateField()` 后开始展示，之后输入时会实时更新。schema 配置错误仍会立即展示并输出到控制台。隐藏或禁用的字段会跳过校验，禁用状态会向嵌套字段传递；对象和数组内部当前已挂载的字段会被递归校验。

未配置 `component` 时，基础字段会依次按 `string → input`、`number → input-number`、`boolean → bool`、`date → date`、`datetime → datetime`、`time → time` 查询当前渲染器的组件注册中心；未注册时才回退到原生 H5 输入控件。`select` 是可显式配置的通用组件键。除这些内置键外，`component` 和组件注册 API 也支持任意业务自定义字符串。

### 默认基础组件

核心包会在默认 H5 组件注册中心预注册常用组件。目前内置 `select` 和 `upload`。其中 `select` 可直接在字段中指定 `component: 'select'`；它接收 `componentData` 或由 `componentDataKey` 解析得到的选项数组：

```ts
{
  key: 'status',
  name: '状态',
  category: 'basic',
  dataType: 'string',
  component: 'select',
  componentData: [
    { label: '草稿', value: 'draft' },
    { label: '已启用', value: 'enabled' },
    { label: '已停用', value: 'disabled', disabled: true }
  ]
}
```

可从 `componentRegistry` 获取默认 H5 注册中心；额外组件可用 `registerExtraBasicFieldComponent()` 注册，或使用 `unregisterExtraBasicFieldComponent()` 卸载。

#### H5 默认渲染效果

下图展示了默认 H5 渲染器：`select` 在选项加载完成后显示默认值“草稿”；紧随其后的字段使用不存在的数据键，因此显示字段级加载失败提示。

![H5 默认 Select 与数据加载失败效果](./docs/images/playground-h5-select.png)

#### Element Plus 渲染效果

同一份 `component: 'select'` 配置，在 Element Plus 渲染器中会被映射为 `ElSelect + ElOption`；其他基础字段也会使用已注册的 Element Plus 组件。

![Element Plus Select 与数据加载失败效果](./docs/images/playground-element-plus-select.png)

### 对象、数组与 Record 字段

```ts
{
  key: 'contact',
  name: '联系人',
  category: 'object',
  fields: [
    { key: 'name', name: '姓名', category: 'basic', dataType: 'string' }
  ]
}

{
  key: 'tags',
  name: '标签',
  category: 'array',
  element: { category: 'basic', dataType: 'string' },
  defaultValue: ['动态表单']
}
```

`object` 用于 key 在 schema 中预先确定的结构；`record` 用于由用户在运行时输入 key、所有 value 共用一种字段定义的动态对象：

```ts
{
  key: 'metadata',
  name: '扩展属性',
  category: 'record',
  defaultValue: {
    environment: 'production',
    owner: 'form-easy'
  },
  rules: [{ type: 'minLength', value: 1 }],
  kvDef: {
    key: {
      name: '属性名',
      rules: [
        { type: 'pattern', value: '^[A-Za-z][A-Za-z0-9_-]*$' }
      ]
    },
    value: {
      category: 'basic',
      dataType: 'string'
    }
  }
}
```

`kvDef.key` 的字段分类和数据类型固定为 `basic/string`，并且始终必填；可以配置字符串规则、组件、组件数据和组件属性，但不需要重复声明 `category`、`dataType` 或 `required`。`kvDef.value` 与数组 `element` 一样，是不含 `key`、`name` 的匿名字段定义，也可以通过 `{ $ref: '定义名' }` 复用或递归引用 `definitions`。

Record 的运行值是普通对象 `Record<string, unknown>`。编辑器内部使用稳定条目标识，因此连续修改 key 不会造成输入框失焦；空 key、重复 key 以及 `__proto__`、`constructor`、`prototype` 等危险属性名会阻止值提交并显示错误。动态条目的内部字段标识采用 `form.record[0].key` 和 `form.record[0].value` 形式，删除条目后索引会按当前顺序重新编号。Record 的 `required` 与对象字段一致：只有 `null` / `undefined` 不通过，已经创建的 `{}` 可以通过；如需限制动态属性数量，请使用 `minLength` / `maxLength`。

## 默认值、预设值与联动 🔄

- 未传 `value` 时：普通字段按 `defaultValue` 初始化，没有默认值则为 `null`；`optional: true` 的字段默认不输出。
- 传入 `value` 时：普通字段只按预设值初始化，未提供的字段为 `null`；`optional: true` 的字段使用属性是否真实存在来初始化输出状态。
- 每次初始化赋值都会发布 `onChange`，因此绑定状态在首屏即可正确生效。

拥有 `key` 的命名字段可以配置 `optional: true`，允许用户在字段 label 区域控制该属性是否存在于最终 `formData`。未设置时字段名称显示删除线且隐藏值控件；重新设置后恢复原组件和值。存在状态与字段值彼此独立，因此可以区分属性不存在和属性明确等于 `null`：

```ts
{
  key: 'defaultValue',
  name: '默认值',
  category: 'basic',
  dataType: 'string',
  optional: true
}
```

`required` 控制字段值校验，`optional` 控制字段是否写入结果对象。optional 字段处于未设置状态时跳过值校验；设置后再执行 `required` 和 `rules`。`optional` 仅支持拥有 `key` 的命名字段，不适用于 definitions 模板、数组匿名元素和 Record 匿名 value。

拥有 `key` 的顶层字段或对象子字段可以配置 `omitNull: true`。字段值为 `null` 或 `undefined` 时，它仍会进入组件内部状态和 `FormValueStore`，并正常触发初始化事件、绑定与校验，但不会出现在父级对外输出对象中。`false`、`0`、空字符串、空数组和空对象不会被省略：

```ts
{
  key: 'optionalDescription',
  name: '可选说明',
  category: 'basic',
  dataType: 'string',
  omitNull: true
}
```

第一阶段仅支持命名字段使用 `omitNull`；definitions 模板、数组匿名元素以及 Record 的匿名 value 定义中配置它会被 Schema 校验器报告为错误。definitions 被普通命名字段引用时，可以在引用位置通过 `omitNull: true` 覆盖配置。

`optional` 与 `omitNull` 的侧重点不同：前者保存独立的属性存在状态，可以明确输出 `null`；后者直接根据当前值是否为空决定省略。需要区分“继承/未设置”和“明确为 null”时应使用 `optional`。

命名字段还可以配置 `omitWhenHidden: true`。字段通过 `hide` 或 `visible` 绑定进入隐藏状态后，其值仍保留在组件内部和 `FormValueStore` 中，但会从对外 `formData` 中省略；字段重新显示后，原值会再次进入输出。该配置与 `omitNull` 一样，仅支持顶层字段、对象子字段等拥有 `key` 的命名位置：

```ts
{
  key: 'advancedOptions',
  name: '高级选项',
  category: 'basic',
  dataType: 'string',
  omitWhenHidden: true
}
```

字段事件支持 `onShow`、`onHide`、`onDisabled`、`onEnabled`、`onClear`、`onChange`；可调用的 handle 为 `show`、`hide`、`disable`、`enable`、`clear`、`change`。

`binds` 支持 `visible`、`enable`、`value` 三种目标。一个 bind 使用 `params` 声明参数名到源字段引用的映射，`resolver` 可以直接引用全部命名参数。`visible` 与 `enable` 会将 resolver 返回值转换为布尔值，`value` 直接使用返回值。同一字段的同一个 target 只能声明一个 bind；单参数可以省略 resolver，多参数必须显式配置 resolver。

单参数绑定省略 resolver 时，`visible` 与 `enable` 默认将 `null` / `undefined` / `0` / 空字符串视为 `false`，`value` 则直接同步参数原值。多参数能够在一个 resolver 中明确表达完整逻辑：

```ts
{
  target: 'visible',
  params: {
    category: './category',
    reference: './$ref'
  },
  resolver: "return category === 'basic' || reference !== null;"
}
```

数组对象或嵌套对象中的字段可以使用 `./字段key` 引用当前结构的同级字段。运行时会保留当前数组下标，例如目标字段 `order.items[2].detail` 中的 `./type` 会解析为 `order.items[2].type`：

```ts
{
  target: 'visible',
  params: {
    sourceFieldValue: './type'
  },
  resolver: "return sourceFieldValue === 'custom';"
}
```

绑定参数也支持 `otherForm.fieldKey` 形式的完整字段标识。跨表单读取时，相关表单需要显式共用同一个 `FormValueStore` 和 `EventCenter`；相对引用始终从当前字段所在结构解析。

### 事件中心

表单默认使用全局共享的 `globalEventCenter`，相同表单键的字段可跨表单订阅事件。如需隔离一组表单，可自行创建并传入 `EventCenter`：

```ts
import { EventCenter } from '@wenzhencn/form-easy';

const isolatedEventCenter = new EventCenter();
```

```vue
<form-easy :schema.prop="schema" :eventCenter.prop="isolatedEventCenter" />
```

### 组件数据加载

为下拉框等组件配置 `componentData` 可直接提供数据；配置 `componentDataKey` 时，字段将按“表单级数据管理器 → 全局数据管理器”的顺序异步加载数据。加载完成前不会挂载实际字段组件，因此不会出现组件先接收值、后接收选项的时序问题。

```ts
import {
  ComponentDataManager,
  registerGlobalComponentDataManager
} from '@wenzhencn/form-easy';

const componentDataManager = new ComponentDataManager();
componentDataManager.register('status-options', async ({ signal }) => {
  const response = await fetch('/api/options/status', { signal });
  if (!response.ok) throw new Error('选项加载失败');
  return response.json();
});
registerGlobalComponentDataManager(componentDataManager);

const schema = {
  key: 'settings',
  name: '设置',
  fields: [{
    key: 'status',
    name: '状态',
    category: 'basic',
    dataType: 'string',
    component: 'statusSelect',
    componentDataKey: 'status-options'
  }]
};
```

`ComponentDataResolver` 的第二个参数为只读的 `params` 对象。除了在业务代码中通过 `resolve()` 的第三个参数直接传入查询条件，也可以在 schema 的 `componentDataKey` 中声明响应式字段参数：

```ts
componentDataManager.register(
  'city-options',
  async ({ signal }, params) => {
    const provinceCode = String(params.provinceCode ?? '');
    const response = await fetch(`/api/cities?provinceCode=${provinceCode}`, { signal });
    return response.json();
  }
);

const cityOptions = await componentDataManager.resolve(
  'city-options',
  {
    field,
    fieldId: 'address.city',
    formKey: 'address',
    signal: abortController.signal
  },
  {
    provinceCode: '510000'
  }
);
```

```ts
componentDataManager.register(
  'city-options',
  async ({ signal }, params) => {
    const provinceCode = String(params.provinceCode ?? '');
    const response = await fetch(`/api/cities?provinceCode=${provinceCode}`, {
      signal
    });
    return response.json();
  }
);

const schema = {
  key: 'address',
  name: '地址',
  fields: [
    {
      key: 'provinceCode',
      name: '省份',
      category: 'basic',
      dataType: 'string',
      component: 'select',
      componentDataKey: 'province-options'
    },
    {
      key: 'cityCode',
      name: '城市',
      category: 'basic',
      dataType: 'string',
      component: 'select',
      componentDataKey: 'city-options(provinceCode:./provinceCode)'
    }
  ]
};
```

表达式格式为 `key(参数名:字段引用, ...)`。普通的 `componentDataKey: 'status-options'` 保持兼容。参数引用支持以下形式：

- `./fieldKey`：当前字段的同级字段。
- `../fieldKey`、`../../fieldKey`：从当前字段所在容器逐级向上查找。例如数组规则项内的 `../../dataType` 可以引用外层字段定义的 `dataType`。
- `formKey.fieldKey...`：字段的完整唯一标识，可用于引用其他表单。

每个 `<form-easy>` 都拥有独立的 `FormValueStore`。框架从该存储同步读取参数源字段的当前值并订阅后续变化，不依赖事件中心保存历史事件。所有参数都至少获得一次值后才调用解析器；任一参数变化时，框架会取消尚未完成的旧请求，并使用最新参数重新加载组件数据。

也可以显式创建并传入字段值存储，以便表单外部代码读取字段当前值：

```ts
import { FormValueStore } from '@wenzhencn/form-easy';

const formValueStore = new FormValueStore();
formElement.formValueStore = formValueStore;

const currentProvinceCode = formValueStore.getValue(
  'address.provinceCode'
);
```

参数当前只接受字段引用，不解析字面量或任意 JavaScript；表达式语法及当前表单内引用可由 `validateFormSchema()` 提前检查。`EventCenter` 只负责传播组件行为事件，不再保存字段当前值。

`componentData` 优先于 `componentDataKey`；两者同时出现时会输出警告并使用前者。`ComponentDataManager` 按数据键注册加载函数，加载函数接收字段、字段标识、表单键及 `AbortSignal`；字段卸载或配置变更时会自动取消旧请求。数据最终作为 `componentData` 属性传给自定义组件。可通过 `componentDataManager` 属性将独立管理器传入单个 `<form-easy>` 实例。

### 异步端点与文件上传

`EndpointManager` 用于注册上传、远程校验等需要调用接口的异步能力。组件内部决定调用哪个端点键，schema 不保存 URL、鉴权信息、请求函数或端点键；运行时按“表单级端点管理器 → 全局端点管理器”的顺序解析。

```ts
import { EndpointManager, registerGlobalEndpointManager } from '@wenzhencn/form-easy';

const endpointManager = new EndpointManager();
endpointManager.register<File, string>('upload', async ({ input, signal }) => {
  const formData = new FormData();
  formData.append('file', input);
  const response = await fetch('/api/files', {
    method: 'POST',
    body: formData,
    signal
  });
  if (!response.ok) throw new Error('上传失败');
  return (await response.json()).url;
});
registerGlobalEndpointManager(endpointManager);
```

上传组件使用内置 `upload` 端点键。单文件字段值为端点返回的 URL 字符串；`multiple: true` 时，字段值为 URL 数组的 JSON 字符串。H5、Vue 与 Element Plus 渲染器均提供 `upload` 组件；Element Plus 版本内部使用 `ElUpload`。

```ts
{
  key: 'images',
  name: '商品图片',
  category: 'basic',
  dataType: 'string',
  component: 'upload',
  componentProperties: {
    accept: 'image/*',
    multiple: true
  }
}
```

如需隔离某个表单的服务实现，可将 `EndpointManager` 通过 `endpointManager` 属性传入 `<form-easy>`。

## 本地开发 🛠️

```bash
git clone https://github.com/meteorzh/form-easy.git
cd form-easy
npm install
npm run dev
```

常用命令：

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vue Playground。 |
| `npm run build` | 构建全部工作区包。 |
| `npm test` | 执行已配置的测试。 |
| `npm pack --workspace=@wenzhencn/form-easy --dry-run` | 检查核心包的发布内容。 |

## 发布到 npm 📤

发布前请确认 npm 包名未被占用、已登录 npm，并已完成构建与打包检查：

```bash
npm run build
npm pack --workspace=@wenzhencn/form-easy --dry-run
npm pack --workspace=@wenzhencn/form-easy-vue --dry-run

npm publish --workspace=@wenzhencn/form-easy
npm publish --workspace=@wenzhencn/form-easy-vue
```

两个可发布包均已设置 `publishConfig.access: public`、仓库信息、问题追踪链接、关键词和明确的发布文件列表。Playground 的 `private: true` 保持不变，无法被发布。

## 许可证 📄

[Apache-2.0](./LICENSE)
