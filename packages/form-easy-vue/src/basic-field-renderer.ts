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

/** 可按表单独立配置组件的 Vue 基础字段渲染器。 */
export interface VueBasicFieldRenderer extends BasicFieldRenderer {
  /** 注册供当前渲染器使用的 Vue 字段组件。 */
  registerFieldComponent(name: string, component: Component): void;
  /** 移除当前渲染器中的 Vue 字段组件。 */
  unregisterFieldComponent(name: string): void;
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

/**
 * 创建一个拥有独立组件注册中心的 Vue 基础字段渲染器。
 *
 * 创建后的实例可通过 registerFieldComponent 注册组件，并直接作为
 * form-easy 的 basicFieldRenderer 属性传入指定表单。
 */
export function createVueBasicFieldRenderer(): VueBasicFieldRenderer {
  /** 每个渲染器实例维护自己的组件集合，避免不同业务表单相互影响。 */
  const componentRegistry = new ComponentRegistry<Component>();

  return {
    /** 注册供当前渲染器使用的 Vue 字段组件。 */
    registerFieldComponent(name: string, component: Component): void {
      componentRegistry.register(name, component);
    },

    /** 移除当前渲染器中的 Vue 字段组件。 */
    unregisterFieldComponent(name: string): void {
      componentRegistry.unregister(name);
    },

    /** 在宿主元素中渲染或更新一个 Vue 字段视图。 */
    render(host: HTMLElement, context: BasicFieldRenderContext): void {
      const component = context.field.component
        ? componentRegistry.get(context.field.component)
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
}

/** 默认 Vue 渲染器，保留原有全局快捷 API 的兼容性。 */
const defaultVueBasicFieldRenderer = createVueBasicFieldRenderer();

/** 注册供默认 Vue 渲染器使用的字段组件。 */
export function registerVueFieldComponent(name: string, component: Component): void {
  defaultVueBasicFieldRenderer.registerFieldComponent(name, component);
}

/** 从默认 Vue 渲染器移除字段组件。 */
export function unregisterVueFieldComponent(name: string): void {
  defaultVueBasicFieldRenderer.unregisterFieldComponent(name);
}

/** 获取可传入单个 form-easy 实例的 Vue 基础字段渲染器。 */
export function getVueBasicFieldRenderer(): VueBasicFieldRenderer {
  return defaultVueBasicFieldRenderer;
}

/** 安装 Vue 基础字段渲染适配器。 */
export function installVueBasicFieldRenderer(): void {
  registerBasicFieldRenderer(defaultVueBasicFieldRenderer);
}

/** 卸载 Vue 基础字段渲染适配器并恢复核心包默认 H5 渲染。 */
export function uninstallVueBasicFieldRenderer(): void {
  registerBasicFieldRenderer();
}
