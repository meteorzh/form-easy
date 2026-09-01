# form-easy ✨

**一个由 JSON 驱动的动态表单组件库。** `form-easy` 使用 Stencil 构建为标准 Web Components，可在任意前端项目中使用；`form-easy-vue` 则提供 Vue 3 渲染器、独立组件注册中心以及 Element Plus 适配工厂。

> 🧩 一份 schema，按需选择原生 H5、Vue 或第三方 UI 库渲染器。

## 特性 🚀

- 📝 支持字符串、数字、布尔、日期、日期时间和时间基础字段。
- 🌳 支持对象字段与可增删的数组字段，并自动递归渲染。
- 🎛️ 支持默认值与预设值加载；初始化会统一触发字段 `onChange`。
- 🔗 支持字段事件订阅、`visible` / `enable` / `value` 绑定及自定义 resolver。
- 🔄 内置事件流循环检测，避免订阅配置意外形成无限循环。
- 🎨 支持表单级渲染器，默认 H5、Vue 与 Element Plus 实例可同时存在。
- 📐 支持 `left`、`top`、`right` 三种标签位置。

## 包说明 📦

| 包 | 用途 | 是否发布 |
| --- | --- | --- |
| [`form-easy`](./packages/form-easy) | 核心 Web Components、schema 类型、事件与默认 H5 渲染 | ✅ |
| [`form-easy-vue`](./packages/form-easy-vue) | Vue 3 渲染器与 Element Plus 适配工厂 | ✅ |
| [`form-easy-vue-playground`](./packages/form-easy-vue-playground) | 本地交互式示例 | ❌ |

## 安装 💿

### 原生 H5 / 任意框架

```bash
npm install form-easy
```

### Vue 3

```bash
npm install form-easy form-easy-vue vue
```

### Vue 3 + Element Plus

`form-easy-vue` 不会安装或打包 Element Plus。请由业务项目自行选择版本、安装组件库与引入样式：

```bash
npm install form-easy form-easy-vue vue element-plus
```

## 快速开始 ⚡

### 1. 注册 Web Components

在应用启动入口注册一次即可：

```ts
import { defineCustomElements } from 'form-easy/loader';

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

## Vue 3 使用方式 💚

Vue 模板中请使用 `.prop`，将对象和渲染器实例作为 DOM Property 而非字符串属性传入：

```vue
<script setup lang="ts">
import { defineCustomElements } from 'form-easy/loader';

defineCustomElements();

const schema = {
  key: 'profile',
  name: '个人资料',
  fields: []
};
</script>

<template>
  <form-easy :schema.prop="schema" />
</template>
```

### 创建独立 Vue 渲染器

每个 Vue 渲染器都有独立的组件注册中心。适合不同业务表单使用不同组件映射，彼此不会冲突：

```ts
import { createVueBasicFieldRenderer } from 'form-easy-vue';
import UserNameInput from './UserNameInput.vue';

const userRenderer = createVueBasicFieldRenderer();
userRenderer.registerFieldComponent('userNameInput', UserNameInput);
```

```vue
<form-easy
  :schema.prop="schema"
  :basicFieldRenderer.prop="userRenderer"
/>
```

schema 中配置 `component: 'userNameInput'` 后，渲染器会将 `componentProperties`、`modelValue`、`disabled` 和 `update:modelValue` 事件传递给该 Vue 组件。

Vue 渲染器实例会自动注册默认组件列表；目前包含 `select`，会使用 `componentData` 渲染原生下拉选项。

### 使用 Element Plus 渲染器

Element Plus 组件由业务方传入，因此 `form-easy-vue` 不会产生对 Element Plus 的直接依赖：

```ts
import {
  ElDatePicker,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTimePicker
} from 'element-plus';
import 'element-plus/dist/index.css';
import { createElementPlusBasicFieldRenderer } from 'form-easy-vue';

const elementRenderer = createElementPlusBasicFieldRenderer({
  input: ElInput,
  inputNumber: ElInputNumber,
  switch: ElSwitch,
  datePicker: ElDatePicker,
  timePicker: ElTimePicker,
  select: ElSelect,
  option: ElOption
});
```

该渲染器预注册以下组件名：`elementInput`、`elementInputNumber`、`elementSwitch`、`elementDatePicker`、`elementDateTimePicker`、`elementTimePicker`。同时传入 `select: ElSelect` 与 `option: ElOption` 时，还会覆盖注册 `select`，以 `ElSelect + ElOption` 渲染 `componentData` 选项。

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
      component: 'elementInput',
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

### 表单属性

| 属性 | 说明 |
| --- | --- |
| `key` | 表单唯一标识。 |
| `name` | 表单标题。 |
| `fields` | 字段配置列表。 |
| `labelPosition` | 标签位置：`left`（默认）、`top`、`right`。 |

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
  component: 'elementInputNumber',
  componentProperties: { min: 0 }
}
```

`dataType` 可取：`string`、`number`、`boolean`、`date`、`datetime`、`time`。

### 默认基础组件

核心包会在默认 H5 组件注册中心预注册常用组件。目前内置 `select`，可直接在字段中指定 `component: 'select'`；它接收 `componentData` 或由 `componentDataKey` 解析得到的选项数组：

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

### 对象与数组字段

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

## 默认值、预设值与联动 🔄

- 未传 `value` 时：字段按 `defaultValue` 初始化，没有默认值则为 `null`。
- 传入 `value` 时：只按预设值初始化，未提供的字段为 `null`。
- 每次初始化赋值都会发布 `onChange`，因此绑定状态在首屏即可正确生效。

字段事件支持 `onShow`、`onHide`、`onDisabled`、`onEnabled`、`onClear`、`onChange`；可调用的 handle 为 `show`、`hide`、`disable`、`enable`、`clear`、`change`。

`binds` 支持 `visible`、`enable`、`value` 三种目标。`visible` 与 `enable` 默认将 `null` / `undefined` / `0` / 空字符串视为 `false`，也可通过 `resolver` 提供只引用 `sourceFieldValue` 的 JavaScript 代码。

### 事件中心

表单默认使用全局共享的 `globalEventCenter`，相同表单键的字段可跨表单订阅事件。如需隔离一组表单，可自行创建并传入 `EventCenter`：

```ts
import { EventCenter } from 'form-easy';

const isolatedEventCenter = new EventCenter();
```

```vue
<form-easy :schema.prop="schema" :eventCenter.prop="isolatedEventCenter" />
```

### 组件数据加载

为下拉框等组件配置 `componentData` 可直接提供数据；配置 `componentDataKey` 时，字段将按“表单级解析器 → 全局解析器”的顺序异步加载数据。加载完成前不会挂载实际字段组件，因此不会出现组件先接收值、后接收选项的时序问题。

```ts
import { registerGlobalComponentDataResolver } from 'form-easy';

registerGlobalComponentDataResolver(async ({ componentDataKey, signal }) => {
  const response = await fetch(`/api/options/${componentDataKey}`, { signal });
  if (!response.ok) throw new Error('选项加载失败');
  return response.json();
});

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

`componentData` 优先于 `componentDataKey`；两者同时出现时会输出警告并使用前者。解析器接收字段、字段标识、表单键及 `AbortSignal`，字段卸载或配置变更时会自动取消旧请求。数据最终作为 `componentData` 属性传给自定义组件。

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
| `npm pack --workspace=form-easy --dry-run` | 检查核心包的发布内容。 |

## 发布到 npm 📤

发布前请确认 npm 包名未被占用、已登录 npm，并已完成构建与打包检查：

```bash
npm run build
npm pack --workspace=form-easy --dry-run
npm pack --workspace=form-easy-vue --dry-run

npm publish --workspace=form-easy
npm publish --workspace=form-easy-vue
```

两个可发布包均已设置 `publishConfig.access: public`、仓库信息、问题追踪链接、关键词和明确的发布文件列表。Playground 的 `private: true` 保持不变，无法被发布。

## 许可证 📄

[Apache-2.0](./LICENSE)
