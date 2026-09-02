import { h, render, type Component, type VNode } from 'vue';
import {
  ComponentRegistry,
  getDefaultBasicFieldComponentKey,
  registerGlobalBasicFieldRenderer,
  type BasicFieldComponentKey,
  type BasicFieldRenderContext,
  type BasicFieldRenderer
} from 'form-easy';
import { VueSelect } from './basic/vue-select';

/** Vue 渲染器实例初始化时自动注册的常用字段组件。 */
export const defaultVueFieldComponents: ReadonlyArray<{
  /** schema 中使用的组件名称。 */
  name: BasicFieldComponentKey;
  /** 对应的 Vue 组件。 */
  component: Component;
}> = [{ name: 'select', component: VueSelect }];

/** 可按表单独立配置组件的 Vue 基础字段渲染器。 */
export class VueBasicFieldRenderer implements BasicFieldRenderer {
  /** 当前 Vue 渲染器实例独立维护的组件注册中心。 */
  readonly componentRegistry = new ComponentRegistry<Component>();

  /** 创建渲染器并预注册 Vue 内置基础字段组件。 */
  constructor() {
    defaultVueFieldComponents.forEach(({ name, component }) => {
      this.componentRegistry.register(name, component);
    });
  }

  /** 注册供当前渲染器使用的 Vue 字段组件。 */
  registerFieldComponent(name: BasicFieldComponentKey, component: Component): void {
    this.componentRegistry.register(name, component);
  }

  /** 移除当前渲染器中的 Vue 字段组件。 */
  unregisterFieldComponent(name: BasicFieldComponentKey): void {
    this.componentRegistry.unregister(name);
  }

  /** 在宿主元素中渲染或更新一个 Vue 字段视图。 */
  render(host: HTMLElement, context: BasicFieldRenderContext): void {
    const component = this.componentRegistry.get(
      context.field.component
        ?? getDefaultBasicFieldComponentKey(context.field.dataType)
    );
    render(
      component
        ? this.renderVueComponent(component, context)
        : this.renderDefaultField(context),
      host
    );
  }

  /** 卸载宿主元素中的 Vue 视图。 */
  unmount(host: HTMLElement): void {
    render(null, host);
  }

  /** 渲染未配置 Vue 自定义组件时的基础 H5 输入控件。 */
  private renderDefaultField(context: BasicFieldRenderContext): VNode {
    const { dataType } = context.field;
    const onChange = (event: Event) =>
      context.onChange(this.getChangedValue(event, dataType));
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
  private renderVueComponent(
    component: Component,
    context: BasicFieldRenderContext
  ): VNode {
    const onChange = (eventOrValue: unknown) =>
      context.onChange(this.getChangedValue(eventOrValue, context.field.dataType));
    return h(component, {
      ...context.field.componentProperties,
      value: context.value,
      modelValue: context.value,
      componentData: context.componentData,
      disabled: context.disabled,
      'onUpdate:modelValue': onChange,
      onChange
    });
  }

  /** 将 Vue 输入事件中的值统一提取为表单字段值。 */
  private getChangedValue(
    eventOrValue: unknown,
    dataType: BasicFieldRenderContext['field']['dataType']
  ): unknown {
    if (!(eventOrValue instanceof Event)) return eventOrValue;
    const target = eventOrValue.target as HTMLInputElement;
    if (dataType === 'boolean') return target.checked;
    if (dataType === 'number') return Number(target.value);
    return target.value;
  }
}

/** 创建拥有独立组件注册中心的 Vue 基础字段渲染器。 */
export function createVueBasicFieldRenderer(): VueBasicFieldRenderer {
  return new VueBasicFieldRenderer();
}

/** 默认 Vue 渲染器，保留原有全局快捷 API 的兼容性。 */
const defaultVueBasicFieldRenderer = createVueBasicFieldRenderer();

/** 注册供默认 Vue 渲染器使用的字段组件。 */
export function registerVueFieldComponent(
  name: BasicFieldComponentKey,
  component: Component
): void {
  defaultVueBasicFieldRenderer.registerFieldComponent(name, component);
}
/** 从默认 Vue 渲染器移除字段组件注册。 */
export function unregisterVueFieldComponent(name: BasicFieldComponentKey): void {
  defaultVueBasicFieldRenderer.unregisterFieldComponent(name);
}
/** 获取可传入单个 form-easy 实例的 Vue 基础字段渲染器。 */
export function getVueBasicFieldRenderer(): VueBasicFieldRenderer {
  return defaultVueBasicFieldRenderer;
}
/** 安装 Vue 基础字段渲染适配器。 */
export function installVueBasicFieldRenderer(): void {
  registerGlobalBasicFieldRenderer(defaultVueBasicFieldRenderer);
}
/** 卸载 Vue 基础字段渲染适配器并恢复核心包默认 H5 渲染。 */
export function uninstallVueBasicFieldRenderer(): void {
  registerGlobalBasicFieldRenderer();
}
