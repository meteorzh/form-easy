<script setup lang="ts">
import { computed, ref } from 'vue';
import { elementPlusRenderer } from './element-plus-renderer';
import { playgroundVueRenderer } from './playground-vue-renderer';

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
      componentProperties: {
        placeholder: 'Element Plus 输入框'
      },
      required: true,
      hint: '展示 string、required、hint 和 defaultValue 配置。',
      defaultValue: '默认字符串'
    },
    {
      key: 'numberField',
      name: '基础字段：数字类型示例',
      category: 'basic',
      dataType: 'number',
      componentProperties: {
        min: 0,
        max: 9999
      },
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
      key: 'selectField',
      name: '默认组件：select 与 componentDataKey 选项加载示例',
      category: 'basic',
      dataType: 'string',
      component: 'select',
      componentDataKey: 'playground-status-options',
      componentProperties: {
        placeholder: '请选择状态'
      },
      hint: '核心包会预注册 select；该示例通过全局解析器异步加载选项。',
      defaultValue: 'draft'
    },
    {
      key: 'selectDataFailureField',
      name: '组件数据：select 选项加载失败示例',
      category: 'basic',
      dataType: 'string',
      component: 'select',
      componentDataKey: 'playground-missing-options',
      hint: '数据键不存在时会显示字段级错误，且不会挂载实际 select 组件。'
    },
    {
      key: 'dateField',
      name: '基础字段：日期类型示例',
      category: 'basic',
      dataType: 'date',
      componentProperties: {
        type: 'date'
      },
      defaultValue: '2026-08-30'
    },
    {
      key: 'dateTimeField',
      name: '基础字段：日期时间类型示例',
      category: 'basic',
      dataType: 'datetime',
      componentProperties: {
        type: 'datetime'
      },
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
      key: 'vueComponent',
      name: '渲染器差异：Vue 自定义组件与属性透传示例',
      category: 'basic',
      dataType: 'string',
      component: 'playgroundVueInput',
      componentProperties: {
        placeholder: '此属性仅由 Vue 自定义组件以醒目的样式呈现。'
      },
      hint: 'H5 渲染器未注册该组件会回退原生输入框；Vue 渲染器会使用已注册的 Vue 组件。'
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

/** 当前选中的一级渲染器。 */
const activeRenderer = ref<'h5' | 'vue' | 'elementPlus'>('h5');

/** 当前选中的二级初始化场景。 */
const activeScenario = ref<'default' | 'preset'>('default');

/** 当前示例表单的字段标签位置。 */
const labelPosition = ref<'left' | 'top' | 'right'>('left');

/** 标签位置切换器提供的可选项。 */
const labelPositions = ['left', 'top', 'right'] as const;

/** 按一级选择返回表单级渲染器；null 强制使用核心默认 H5 渲染。 */
const selectedRenderer = computed(() =>
  activeRenderer.value === 'vue'
    ? playgroundVueRenderer
    : activeRenderer.value === 'elementPlus'
      ? elementPlusRenderer
      : null
);

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
  selectField: 'enabled',
  objectField: {
    nickname: '预设昵称'
  },
  stringArray: ['预设标签 A', '预设标签 B'],
  valueBindingSource: '预设同步值'
};

/** 当前工作台对应的说明标题。 */
const rendererTitle = computed(() =>
  activeRenderer.value === 'h5'
    ? '默认 H5 渲染器'
    : activeRenderer.value === 'vue'
      ? 'Vue 渲染器'
      : 'Vue + Element UI 渲染器'
);
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
          <p class="description">在同一份 schema 下，检查不同渲染器与初始化策略的表现。</p>
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

      <div class="renderer-workbench">
        <nav class="renderer-rail" aria-label="渲染器选择">
          <p>RENDERER</p>
          <button :class="{ active: activeRenderer === 'h5' }" :aria-current="activeRenderer === 'h5' ? 'page' : undefined" type="button" @click="activeRenderer = 'h5'">
            <strong>H5</strong><span>默认控件</span>
          </button>
          <button :class="{ active: activeRenderer === 'vue' }" :aria-current="activeRenderer === 'vue' ? 'page' : undefined" type="button" @click="activeRenderer = 'vue'">
            <strong>Vue</strong><span>适配器渲染</span>
          </button>
          <button :class="{ active: activeRenderer === 'elementPlus' }" :aria-current="activeRenderer === 'elementPlus' ? 'page' : undefined" type="button" @click="activeRenderer = 'elementPlus'">
            <strong>Element UI</strong><span>Element Plus 组件</span>
          </button>
        </nav>

        <div class="workbench-main">
          <nav class="scenario-nav" aria-label="初始化场景">
            <button :class="{ active: activeScenario === 'default' }" :aria-pressed="activeScenario === 'default'" type="button" @click="activeScenario = 'default'">默认值加载</button>
            <button :class="{ active: activeScenario === 'preset' }" :aria-pressed="activeScenario === 'preset'" type="button" @click="activeScenario = 'preset'">预设值加载</button>
          </nav>

          <div class="content-grid">
            <section class="form-surface" aria-live="polite">
              <div class="tab-panel">
                <div class="panel-heading">
                  <span>{{ activeRenderer === 'h5' ? '01 / H5 DEFAULT' : activeRenderer === 'vue' ? '02 / VUE ADAPTER' : '03 / ELEMENT PLUS' }}</span>
                  <p>{{ activeScenario === 'default' ? '未传入预设值，字段按 schema 的默认值或 null 初始化。' : '传入预设值后，未出现在预设中的字段统一初始化为 null。' }}</p>
                </div>
                <form-easy
                  :key="`${activeRenderer}-${activeScenario}-${labelPosition}`"
                  :schema.prop="activeSchema"
                  :value.prop="activeScenario === 'preset' ? presetValue : undefined"
                  :basicFieldRenderer.prop="selectedRenderer"
                />
              </div>
            </section>

            <aside class="inspector" aria-label="示例说明">
          <p class="eyebrow">{{ activeRenderer === 'h5' ? 'CORE RENDERER' : activeRenderer === 'vue' ? 'VUE ADAPTER' : 'ELEMENT PLUS' }}</p>
          <h2>{{ rendererTitle }}</h2>
          <p class="renderer-description">{{ activeRenderer === 'h5' ? '表单级传入 null，强制走 form-easy 内置 H5 控件与核心组件注册中心。' : activeRenderer === 'vue' ? '表单级传入 Vue renderer，组件名会从 Playground 的 Vue 专用注册中心解析。' : '表单级传入独立的 Element Plus renderer，会按数据类型自动解析 input、input-number、bool、date、datetime、time 等组件。' }}</p>
          <p class="current-position">当前标签位置：<strong>{{ labelPosition }}</strong></p>
          <ol v-if="activeScenario === 'default'">
            <li>挂载表单控件并注册字段订阅。</li>
            <li>读取每个字段的 defaultValue。</li>
            <li>缺失默认值时写入 null 并触发 onChange。</li>
          </ol>
          <ol v-else>
            <li>挂载表单控件并注册字段订阅。</li>
            <li>仅按预设对象写入字段值。</li>
            <li>缺失字段写入 null 并触发 onChange。</li>
          </ol>
          <div v-if="activeScenario === 'preset'" class="preset-preview">
            <p>当前传入预设</p>
            <pre>{{ JSON.stringify(presetValue, null, 2) }}</pre>
          </div>
            </aside>
          </div>
        </div>
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

.renderer-workbench { display: grid; grid-template-columns: 170px minmax(0, 1fr); min-height: 620px; border-top: 1px solid #d9deea; border-bottom: 1px solid #d9deea; }
.renderer-rail { display: flex; flex-direction: column; gap: 6px; padding: 28px 18px; border-right: 1px solid #d9deea; background: #f1f3f7; }
.renderer-rail p { margin: 0 0 10px; color: #778298; font: 750 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .12em; }
.renderer-rail button { display: grid; gap: 4px; padding: 12px; border: 1px solid transparent; border-radius: 6px; color: #69758a; background: transparent; cursor: pointer; text-align: left; transition: background .15s ease, border-color .15s ease, color .15s ease; }
.renderer-rail button:hover { color: #172033; background: #fff; }
.renderer-rail button.active { border-color: #a7d76a; color: #172033; background: #fff; box-shadow: 0 2px 7px rgb(23 32 51 / 5%); }
.renderer-rail strong { font-size: 15px; letter-spacing: -.02em; }
.renderer-rail span { font-size: 11px; }

.workbench-main { min-width: 0; }
.scenario-nav { display: flex; gap: 22px; padding: 21px 34px 0; border-bottom: 1px solid #e1e5ee; }
.scenario-nav button { position: relative; padding: 0 0 14px; border: 0; color: #7a8598; background: transparent; cursor: pointer; font: inherit; font-size: 13px; }
.scenario-nav button::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; content: ""; background: #101827; transform: scaleX(0); transition: transform .2s ease; }
.scenario-nav button:hover { color: #101827; }
.scenario-nav button.active { color: #101827; font-weight: 700; }
.scenario-nav button.active::after { transform: scaleX(1); }

.content-grid { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 42px; padding: 30px 34px 38px; }

.form-surface { min-width: 0; }
.tab-panel { animation: panel-in .25s ease-out both; }

.panel-heading { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 20px; border-bottom: 1px solid #e1e5ee; }
.panel-heading span { color: #27354f; font-size: 12px; font-weight: 750; letter-spacing: .08em; }
.panel-heading p { max-width: 340px; margin-bottom: 0; color: #738096; font-size: 13px; line-height: 1.5; text-align: right; }

.inspector { align-self: start; padding: 3px 0 0 24px; border-left: 1px solid #d9deea; }
.inspector h2 { margin-bottom: 18px; color: #1f2a3d; font-size: 20px; letter-spacing: -.035em; }
.renderer-description { margin-bottom: 18px; color: #68758a; font-size: 13px; line-height: 1.55; }
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
  .renderer-workbench { grid-template-columns: 1fr; border-top: 0; }
  .renderer-rail { display: grid; grid-template-columns: 1fr 1fr; padding: 18px 0; border-right: 0; border-bottom: 1px solid #d9deea; background: transparent; }
  .renderer-rail p { grid-column: 1 / -1; padding: 0 2px; }
  .scenario-nav { padding: 20px 0 0; }
  .content-grid { grid-template-columns: 1fr; gap: 34px; }
  .inspector { padding: 22px 0 0; border-top: 1px solid #d9deea; border-left: 0; }
}
</style>
