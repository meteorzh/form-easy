import {
  ComponentRegistry
} from '../managers/component-registry';
import {
  getDefaultBasicFieldComponentKey,
  type BasicFieldComponentKey
} from '../types';
import type {
  BasicFieldRenderContext,
  BasicFieldRenderer
} from './basic-field-renderer';

/** H5 渲染器注册 Web Component 所需的组件描述。 */
export interface RegisteredComponent {
  /** 自定义元素标签名。 */
  tagName: string;
}

/** 使用原生 DOM 与 Web Components 渲染基础字段的默认 H5 渲染器。 */
export class H5BasicFieldRenderer implements BasicFieldRenderer {
  /** 当前 H5 渲染器实例独立维护的组件注册中心。 */
  readonly componentRegistry = new ComponentRegistry<RegisteredComponent>();

  /** 在宿主元素中创建或更新原生 H5 控件或已注册的 Web Component。 */
  render(host: HTMLElement, context: BasicFieldRenderContext): void {
    host.replaceChildren();
    const registeredComponent = this.componentRegistry.get(
      this.getComponentKey(context)
    );
    const fieldElement = registeredComponent
      ? this.createRegisteredComponent(registeredComponent, context)
      : this.createDefaultInput(context);
    host.append(fieldElement);
  }

  /** 清空宿主元素及其已绑定的事件监听器。 */
  unmount(host: HTMLElement): void {
    host.replaceChildren();
  }

  /** 创建并配置已注册的 Web Component。 */
  private createRegisteredComponent(
    registeredComponent: RegisteredComponent,
    context: BasicFieldRenderContext
  ): HTMLElement {
    const component = document.createElement(registeredComponent.tagName);
    Object.entries(context.field.componentProperties ?? {}).forEach(([name, value]) => {
      (component as unknown as Record<string, unknown>)[name] = value;
    });
    (component as unknown as Record<string, unknown>).value = context.value;
    (component as unknown as Record<string, unknown>).componentData = context.componentData;
    (component as unknown as Record<string, unknown>).disabled = context.disabled;
    component.addEventListener('change', this.createComponentChangeHandler(context));
    component.addEventListener('valueChange', this.createComponentChangeHandler(context));
    return component;
  }

  /** 创建原生 input，并按字段数据类型配置其行为。 */
  private createDefaultInput(context: BasicFieldRenderContext): HTMLInputElement {
    const input = document.createElement('input');
    input.disabled = context.disabled;
    if (context.field.dataType === 'boolean') {
      input.type = 'checkbox';
      input.checked = Boolean(context.value);
      input.addEventListener('change', () => context.onChange(input.checked));
      return input;
    }

    input.type = this.getNativeInputType(context.field.dataType);
    input.value = String(context.value ?? '');
    input.addEventListener('input', () => {
      context.onChange(context.field.dataType === 'number' ? Number(input.value) : input.value);
    });
    return input;
  }

  /** 将 form-easy 数据类型映射为原生 input type。 */
  private getNativeInputType(dataType: BasicFieldRenderContext['field']['dataType']): string {
    if (dataType === 'datetime') return 'datetime-local';
    return dataType === 'string' || !dataType ? 'text' : dataType;
  }

  /** 创建接收 Web Component 自定义事件值的处理函数。 */
  private createComponentChangeHandler(context: BasicFieldRenderContext): (event: Event) => void {
    return (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      context.onChange(event.detail);
    };
  }

  /** 获取字段显式配置或由数据类型推导出的组件注册键。 */
  private getComponentKey(context: BasicFieldRenderContext): BasicFieldComponentKey {
    return context.field.component
      ?? getDefaultBasicFieldComponentKey(context.field.dataType);
  }
}

/** form-easy 在未指定其他渲染器时使用的默认 H5 渲染器。 */
export const defaultH5BasicFieldRenderer = new H5BasicFieldRenderer();

/** 默认 H5 渲染器使用的组件注册中心。 */
export const componentRegistry = defaultH5BasicFieldRenderer.componentRegistry;

/** 核心包内置并会在初始化时自动注册的常用 H5 基础字段组件。 */
export const defaultBasicFieldComponents: ReadonlyArray<{
  /** schema 中使用的组件名称。 */
  name: BasicFieldComponentKey;
  /** 对应的 Web Component 注册信息。 */
  component: RegisteredComponent;
}> = [{ name: 'select', component: { tagName: 'form-easy-select' } }];

/** 将内置组件注册到默认 H5 渲染器自己的组件注册中心。 */
defaultBasicFieldComponents.forEach(({ name, component }) => {
  componentRegistry.register(name, component);
});

/** 为默认 H5 渲染器注册额外的自定义元素组件。 */
export function registerExtraBasicFieldComponent(
  name: BasicFieldComponentKey,
  component: RegisteredComponent
): void {
  componentRegistry.register(name, component);
}

/** 从默认 H5 渲染器中卸载额外的自定义元素组件。 */
export function unregisterExtraBasicFieldComponent(name: BasicFieldComponentKey): void {
  componentRegistry.unregister(name);
}
