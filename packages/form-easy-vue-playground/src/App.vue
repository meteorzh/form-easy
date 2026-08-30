<script setup lang="ts">
import { computed, ref } from 'vue';

/** 演示基础、对象、数组和事件驱动字段。 */
const schema = {
  key: 'form1',
  name: 'form-easy 全功能示例表单',
  fields: [
    {
      key: 'stringDefault',
      name: '基础字段：字符串默认值示例',
      category: 'basic',
      dataType: 'string',
      required: true,
      hint: '展示 string、required、hint 和 defaultValue 配置。',
      defaultValue: '默认字符串'
    },
    {
      key: 'numberField',
      name: '基础字段：数字类型示例',
      category: 'basic',
      dataType: 'number',
      defaultValue: 100
    },
    {
      key: 'booleanField',
      name: '基础字段：布尔类型示例',
      category: 'basic',
      dataType: 'boolean',
      defaultValue: true
    },
    {
      key: 'dateField',
      name: '基础字段：日期类型示例',
      category: 'basic',
      dataType: 'date',
      defaultValue: '2026-08-30'
    },
    {
      key: 'dateTimeField',
      name: '基础字段：日期时间类型示例',
      category: 'basic',
      dataType: 'datetime',
      defaultValue: '2026-08-30T09:30'
    },
    {
      key: 'timeField',
      name: '基础字段：时间类型示例',
      category: 'basic',
      dataType: 'time',
      defaultValue: '09:30'
    },
    {
      key: 'componentFallback',
      name: '基础字段：自定义组件与组件属性透传示例',
      category: 'basic',
      dataType: 'string',
      component: '未注册组件示例',
      componentProperties: {
        placeholder: '该属性会透传给已注册组件；未注册时回退为原生输入框。'
      },
      hint: '展示 component 和 componentProperties 配置，以及未注册组件的原生控件回退。'
    },
    {
      key: 'objectField',
      name: '对象字段：无独立表单键的子表单示例',
      category: 'object',
      defaultValue: {
        nickname: '默认昵称',
        address: { city: '成都' }
      },
      fields: [
        {
          key: 'nickname',
          name: '对象子字段：字符串默认值示例',
          category: 'basic',
          dataType: 'string',
          required: true,
          defaultValue: 'form-easy'
        },
        {
          key: 'address',
          name: '对象子字段：嵌套对象字段示例',
          category: 'object',
          fields: [
            {
              key: 'city',
              name: '嵌套对象子字段：城市',
              category: 'basic',
              dataType: 'string',
              defaultValue: '成都'
            }
          ]
        }
      ]
    },
    {
      key: 'stringArray',
      name: '数组字段：基础字符串元素的增删示例',
      category: 'array',
      element: {
        category: 'basic',
        dataType: 'string',
        hint: '数组元素定义没有 key 和 name。'
      },
      defaultValue: ['默认标签一', '默认标签二']
    },
    {
      key: 'objectArray',
      name: '数组字段：对象元素的递归渲染示例',
      category: 'array',
      element: {
        category: 'object',
        fields: [
          {
            key: 'itemName',
            name: '数组对象元素：名称',
            category: 'basic',
            dataType: 'string'
          },
          {
            key: 'itemEnabled',
            name: '数组对象元素：布尔值',
            category: 'basic',
            dataType: 'boolean'
          }
        ]
      },
      defaultValue: [{ itemName: '默认对象元素', itemEnabled: true }]
    },
    {
      key: 'eventSource',
      name: '事件订阅：onChange 事件源示例',
      category: 'basic',
      dataType: 'string',
      hint: '修改此值会通过 eventSubscriptions 隐藏下一字段。'
    },
    {
      key: 'eventSubscriptionTarget',
      name: '事件订阅：hide handle 目标示例',
      category: 'basic',
      dataType: 'string',
      eventSubscriptions: [
        {
          sourceFormKey: 'form1',
          sourceFieldKey: 'form1.eventSource',
          eventName: 'onChange',
          handle: 'hide'
        }
      ]
    },
    {
      key: 'visibleBindingSource',
      name: 'visible 绑定：onChange 布尔值绑定源示例',
      category: 'basic',
      dataType: 'string',
      hint: '空字符串会隐藏下一字段，非空字符串会显示下一字段。'
    },
    {
      key: 'visibleBindingTarget',
      name: 'visible 绑定：目标字段示例',
      category: 'basic',
      dataType: 'string',
      binds: [
        {
          sourceFormKey: 'form1',
          sourceFieldId: 'form1.visibleBindingSource',
          target: 'visible',
          resolver: 'return sourceFieldValue === "1";'
        }
      ]
    },
    {
      key: 'enableBindingSource',
      name: 'enable 绑定：onChange 布尔值绑定源示例',
      category: 'basic',
      dataType: 'string',
      hint: '空字符串会禁用下一字段，非空字符串会启用下一字段。'
    },
    {
      key: 'enableBindingTarget',
      name: 'enable 绑定：目标字段示例',
      category: 'basic',
      dataType: 'string',
      binds: [
        {
          sourceFormKey: 'form1',
          sourceFieldId: 'form1.enableBindingSource',
          target: 'enable'
        }
      ]
    },
    {
      key: 'valueBindingSource',
      name: 'value 绑定：onChange 绑定源示例',
      category: 'basic',
      dataType: 'string',
      hint: '修改此值会同步到下一字段。'
    },
    {
      key: 'valueBindingTarget',
      name: 'value 绑定：目标字段示例',
      category: 'basic',
      dataType: 'string',
      binds: [
        {
          sourceFormKey: 'form1',
          sourceFieldId: 'form1.valueBindingSource',
          target: 'value'
        }
      ]
    }
  ]
};

/** 当前选中的示例标签。 */
const activeTab = ref<'render' | 'preset'>('render');

/** 当前示例表单的字段标签位置。 */
const labelPosition = ref<'left' | 'top' | 'right'>('left');

/** 标签位置切换器提供的可选项。 */
const labelPositions = ['left', 'top', 'right'] as const;

/** 将当前标签位置合并到传递给表单组件的 schema。 */
const activeSchema = computed(() => ({
  ...schema,
  labelPosition: labelPosition.value
}));

/** 用于演示预设值覆盖与缺失字段回退 null 的数据。 */
const presetValue = {
  stringDefault: '预设值覆盖字符串默认值',
  numberField: 2026,
  booleanField: false,
  objectField: {
    nickname: '预设昵称'
  },
  stringArray: ['预设标签 A', '预设标签 B'],
  valueBindingSource: '预设同步值'
};
</script>

<template>
  <main class="playground">
    <header class="masthead">
      <div class="brand">
        <span class="brand-mark">fe</span>
        <span>form-easy</span>
      </div>
      <p>动态表单组件工作台</p>
    </header>

    <section class="workspace" aria-labelledby="page-title">
      <div class="workspace-heading">
        <div>
          <p class="eyebrow">PLAYGROUND / VUE</p>
          <h1 id="page-title">动态表单示例</h1>
          <p class="description">在不同初始化策略下检查 schema、默认值、预设值和字段联动。</p>
        </div>
        <div class="workspace-actions">
          <div class="label-position-control" role="group" aria-label="字段标签位置">
            <span>标签位置</span>
            <button
              v-for="position in labelPositions"
              :key="position"
              type="button"
              :class="{ active: labelPosition === position }"
              :aria-pressed="labelPosition === position"
              @click="labelPosition = position"
            >
              {{ position }}
            </button>
          </div>
          <span class="status"><i></i>组件已加载</span>
        </div>
      </div>

      <nav class="tabs" aria-label="示例类型">
        <button
          type="button"
          :class="{ active: activeTab === 'render' }"
          :aria-selected="activeTab === 'render'"
          @click="activeTab = 'render'"
        >
          表单渲染示例
        </button>
        <button
          type="button"
          :class="{ active: activeTab === 'preset' }"
          :aria-selected="activeTab === 'preset'"
          @click="activeTab = 'preset'"
        >
          表单预设值加载示例
        </button>
      </nav>

      <div class="content-grid">
        <section class="form-surface" aria-live="polite">
          <div v-if="activeTab === 'render'" class="tab-panel">
            <div class="panel-heading">
              <span>01 / 默认渲染</span>
              <p>未传入预设值，字段按 schema 的默认值或 null 初始化。</p>
            </div>
            <form-easy :schema.prop="activeSchema" />
          </div>

          <div v-else class="tab-panel">
            <div class="panel-heading">
              <span>02 / 预设值加载</span>
              <p>传入预设值后，未出现在预设中的字段统一初始化为 null。</p>
            </div>
            <form-easy :schema.prop="activeSchema" :value.prop="presetValue" />
          </div>
        </section>

        <aside class="inspector" aria-label="示例说明">
          <p class="eyebrow">INITIALIZATION</p>
          <h2>{{ activeTab === 'render' ? '默认值路径' : '预设值路径' }}</h2>
          <p class="current-position">当前标签位置：<strong>{{ labelPosition }}</strong></p>
          <ol v-if="activeTab === 'render'">
            <li>挂载表单控件并注册字段订阅。</li>
            <li>读取每个字段的 defaultValue。</li>
            <li>缺失默认值时写入 null 并触发 onChange。</li>
          </ol>
          <ol v-else>
            <li>挂载表单控件并注册字段订阅。</li>
            <li>仅按预设对象写入字段值。</li>
            <li>缺失字段写入 null 并触发 onChange。</li>
          </ol>
          <div v-if="activeTab === 'preset'" class="preset-preview">
            <p>当前传入预设</p>
            <pre>{{ JSON.stringify(presetValue, null, 2) }}</pre>
          </div>
        </aside>
      </div>
    </section>
  </main>
</template>

<style>
:root {
  color: #172033;
  background: #f7f8fb;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }

body { margin: 0; }

.playground { min-height: 100vh; background: #f7f8fb; }

.masthead {
  height: 64px;
  padding: 0 max(24px, calc((100vw - 1200px) / 2));
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #f9fafb;
  background: #101827;
}

.masthead p { margin: 0; color: #a7b1c3; font-size: 13px; }

.brand { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 720; letter-spacing: -0.02em; }

.brand-mark {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  color: #101827;
  background: #b9ff66;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 800;
}

.workspace { width: min(1200px, calc(100% - 48px)); margin: 0 auto; padding: 72px 0; }

.workspace-heading { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 38px; }
.workspace-actions { display: flex; align-items: end; flex-direction: column; gap: 14px; }

.eyebrow { margin: 0 0 10px; color: #69748a; font-size: 11px; font-weight: 750; letter-spacing: .14em; }

h1, h2, p { margin-top: 0; }

h1 { margin-bottom: 12px; color: #101827; font-size: clamp(32px, 5vw, 52px); letter-spacing: -.055em; line-height: .98; }

.description { margin-bottom: 0; color: #667085; font-size: 15px; }

.status { display: inline-flex; align-items: center; gap: 8px; color: #526078; font-size: 13px; white-space: nowrap; }
.status i { width: 7px; height: 7px; border-radius: 50%; background: #65c466; box-shadow: 0 0 0 4px #e1f4e0; }

.label-position-control { display: flex; align-items: center; gap: 3px; padding: 3px; border: 1px solid #d9deea; background: #fff; }
.label-position-control > span { padding: 0 8px; color: #748096; font-size: 12px; white-space: nowrap; }
.label-position-control button { border: 0; padding: 6px 8px; color: #68758a; background: transparent; cursor: pointer; font: 700 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace; transition: color .15s ease, background .15s ease; }
.label-position-control button:hover { color: #101827; background: #f1f3f7; }
.label-position-control button.active { color: #101827; background: #b9ff66; }

.tabs { display: flex; gap: 28px; border-bottom: 1px solid #d9deea; }

.tabs button { position: relative; padding: 0 0 15px; border: 0; color: #7a8598; background: transparent; cursor: pointer; font: inherit; font-size: 14px; }
.tabs button::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; content: ""; background: #101827; transform: scaleX(0); transition: transform .2s ease; }
.tabs button:hover { color: #101827; }
.tabs button.active { color: #101827; font-weight: 700; }
.tabs button.active::after { transform: scaleX(1); }

.content-grid { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 56px; padding-top: 34px; }

.form-surface { min-width: 0; }
.tab-panel { animation: panel-in .25s ease-out both; }

.panel-heading { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 20px; border-bottom: 1px solid #e1e5ee; }
.panel-heading span { color: #27354f; font-size: 12px; font-weight: 750; letter-spacing: .08em; }
.panel-heading p { max-width: 340px; margin-bottom: 0; color: #738096; font-size: 13px; line-height: 1.5; text-align: right; }

.inspector { align-self: start; padding: 3px 0 0 24px; border-left: 1px solid #d9deea; }
.inspector h2 { margin-bottom: 18px; color: #1f2a3d; font-size: 20px; letter-spacing: -.035em; }
.current-position { margin-bottom: 20px; color: #718096; font-size: 13px; }
.current-position strong { color: #27354f; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.inspector ol { padding-left: 19px; margin: 0; color: #68758a; font-size: 13px; line-height: 1.7; }
.inspector li + li { margin-top: 8px; }

.preset-preview { margin-top: 28px; }
.preset-preview p { margin-bottom: 8px; color: #4f5d73; font-size: 12px; font-weight: 700; }
.preset-preview pre { max-height: 270px; margin: 0; overflow: auto; padding: 12px; color: #b9ff66; background: #101827; font: 11px/1.55 "SFMono-Regular", Consolas, monospace; }

@keyframes panel-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 820px) {
  .workspace { width: min(100% - 32px, 640px); padding: 42px 0; }
  .masthead { padding: 0 16px; }
  .masthead p { display: none; }
  .workspace-heading, .panel-heading { align-items: flex-start; flex-direction: column; }
  .workspace-actions { align-items: flex-start; }
  .panel-heading p { text-align: left; }
  .content-grid { grid-template-columns: 1fr; gap: 34px; }
  .inspector { padding: 22px 0 0; border-top: 1px solid #d9deea; border-left: 0; }
}
</style>
