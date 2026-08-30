import {
  h,
  render,
  type Component,
  type VNode
} from 'vue';
import {
  ComponentRegistry,
  registerBasicFieldRenderer,
  type BasicFieldRenderContext,
  type BasicFieldRenderer
} from 'form-easy';

/** Vue 基础字段渲染器内部使用的组件注册中心。 */
const vueFieldComponentRegistry = new ComponentRegistry<Component>();

/** 注册供 form-easy 字段配置使用的 Vue 组件。 */
export function registerVueFieldComponent(name: string, component: Component): void {
  vueFieldComponentRegistry.register(name, component);
}

/** 移除一个 Vue 基础字段组件注册。 */
export function unregisterVueFieldComponent(name: string): void {
  vueFieldComponentRegistry.unregister(name);
}

/** 将 Vue 输入事件中的值统一提取为表单字段值。 */
function getChangedValue(eventOrValue: unknown, dataType: BasicFieldRenderContext['field']['dataType']): unknown {
  if (!(eventOrValue instanceof Event)) return eventOrValue;

  const target = eventOrValue.target as HTMLInputElement;
  if (dataType === 'boolean') return target.checked;
  if (dataType === 'number') return Number(target.value);
  return target.value;
}

/** 渲染未配置 Vue 自定义组件时的基础 H5 输入控件。 */
function renderDefaultField(context: BasicFieldRenderContext): VNode {
  const { dataType } = context.field;
  const onChange = (event: Event) => context.onChange(getChangedValue(event, dataType));

  if (dataType === 'boolean') {
    return h('input', {
      type: 'checkbox',
      checked: Boolean(context.value),
      disabled: context.disabled,
      onChange
    });
  }

  const type = dataType === 'datetime'
    ? 'datetime-local'
    : dataType === 'string' || !dataType
      ? 'text'
      : dataType;
  return h('input', {
    type,
    value: String(context.value ?? ''),
    disabled: context.disabled,
    onInput: onChange
  });
}

/** 渲染已注册 Vue 字段组件，并将通用字段上下文透传给它。 */
function renderVueComponent(component: Component, context: BasicFieldRenderContext): VNode {
  const onChange = (eventOrValue: unknown) =>
    context.onChange(getChangedValue(eventOrValue, context.field.dataType));

  return h(component, {
    ...context.field.componentProperties,
    value: context.value,
    modelValue: context.value,
    disabled: context.disabled,
    'onUpdate:modelValue': onChange,
    onChange
  });
}

/** 使用 Vue runtime 渲染 form-easy 基础字段的适配器。 */
const vueBasicFieldRenderer: BasicFieldRenderer = {
  /** 在宿主元素中渲染或更新一个 Vue 字段视图。 */
  render(host: HTMLElement, context: BasicFieldRenderContext): void {
    const component = context.field.component
      ? vueFieldComponentRegistry.get(context.field.component)
      : undefined;
    render(
      component ? renderVueComponent(component, context) : renderDefaultField(context),
      host
    );
  },

  /** 卸载宿主元素中的 Vue 视图。 */
  unmount(host: HTMLElement): void {
    render(null, host);
  }
};

/** 获取可传入单个 form-easy 实例的 Vue 基础字段渲染器。 */
export function getVueBasicFieldRenderer(): BasicFieldRenderer {
  return vueBasicFieldRenderer;
}

/** 安装 Vue 基础字段渲染适配器。 */
export function installVueBasicFieldRenderer(): void {
  registerBasicFieldRenderer(vueBasicFieldRenderer);
}

/** 卸载 Vue 基础字段渲染适配器并恢复核心包默认 H5 渲染。 */
export function uninstallVueBasicFieldRenderer(): void {
  registerBasicFieldRenderer();
}
