import { type BasicFieldComponentKey } from '../types';
import type {
  BasicFieldRenderContext
} from './basic-field-renderer';
import { AbstractBasicFieldRenderer } from './abstract-basic-field-renderer';

/** H5 渲染器注册 Web Component 所需的组件描述。 */
export interface RegisteredComponent {
  /** 自定义元素标签名。 */
  tagName: string;
}

/** 使用原生 DOM 与 Web Components 渲染基础字段的默认 H5 渲染器。 */
export class H5BasicFieldRenderer extends AbstractBasicFieldRenderer<RegisteredComponent> {
  /** 保存已挂载控件最新的渲染上下文，供稳定的事件监听器读取。 */
  private readonly fieldContexts = new WeakMap<
    HTMLElement,
    BasicFieldRenderContext
  >();
  /** 保存自定义组件上一次透传的属性键，用于移除已经失效的旧属性。 */
  private readonly componentPropertyKeys = new WeakMap<
    HTMLElement,
    Set<string>
  >();

  /** 挂载或原位更新已注册的 Web Component。 */
  protected renderRegisteredComponent(
    host: HTMLElement,
    registeredComponent: RegisteredComponent,
    context: BasicFieldRenderContext
  ): void {
    const component = this.getOrCreateRegisteredComponent(
      host,
      registeredComponent
    );
    this.updateRegisteredComponent(component, context);
  }

  /** 挂载或原位更新当前数据类型的原生 H5 输入控件。 */
  protected renderDefaultField(
    host: HTMLElement,
    context: BasicFieldRenderContext
  ): void {
    const input = this.getOrCreateDefaultInput(host, context);
    this.updateDefaultInput(input, context);
  }

  /** 渲染显式配置组件未注册时的错误提示。 */
  protected renderMissingComponentError(host: HTMLElement, message: string): void {
    const error = document.createElement('p');
    error.textContent = message;
    error.className = 'form-easy-renderer-error';
    host.replaceChildren(error);
  }

  /** 清空宿主元素及其已绑定的事件监听器。 */
  unmount(host: HTMLElement): void {
    host.replaceChildren();
  }

  /** 创建并配置已注册的 Web Component。 */
  private createRegisteredComponent(
    registeredComponent: RegisteredComponent
  ): HTMLElement {
    const component = document.createElement(registeredComponent.tagName);
    component.addEventListener('change', event => {
      this.handleComponentChange(component, event);
    });
    component.addEventListener('valueChange', event => {
      this.handleComponentChange(component, event);
    });
    return component;
  }

  /** 获取标签匹配的现有自定义组件，不匹配时创建并替换旧视图。 */
  private getOrCreateRegisteredComponent(
    host: HTMLElement,
    registeredComponent: RegisteredComponent
  ): HTMLElement {
    const currentComponent = host.firstElementChild;
    const expectedTagName = registeredComponent.tagName.toLowerCase();
    if (
      host.childElementCount === 1
      && currentComponent instanceof HTMLElement
      && currentComponent.tagName.toLowerCase() === expectedTagName
    ) {
      return currentComponent;
    }
    const component = this.createRegisteredComponent(registeredComponent);
    host.replaceChildren(component);
    return component;
  }

  /** 将最新字段上下文和组件属性同步到现有自定义组件。 */
  private updateRegisteredComponent(
    component: HTMLElement,
    context: BasicFieldRenderContext
  ): void {
    const componentRecord = component as unknown as Record<string, unknown>;
    const componentProperties = context.field.componentProperties ?? {};
    const previousPropertyKeys = this.componentPropertyKeys.get(component)
      ?? new Set();
    previousPropertyKeys.forEach(name => {
      if (!Object.prototype.hasOwnProperty.call(componentProperties, name)) {
        componentRecord[name] = undefined;
      }
    });
    Object.entries(componentProperties).forEach(([name, value]) => {
      componentRecord[name] = value;
    });
    this.componentPropertyKeys.set(
      component,
      new Set(Object.keys(componentProperties))
    );
    this.fieldContexts.set(component, context);
    componentRecord.value = context.value;
    componentRecord.componentData = context.componentData;
    componentRecord.disabled = context.disabled;
    componentRecord.endpointManager = context.endpointManager;
    componentRecord.field = context.field;
    componentRecord.fieldId = context.fieldId;
    componentRecord.formKey = context.formKey;
  }

  /** 获取类型匹配的现有原生输入控件，不匹配时创建并替换旧视图。 */
  private getOrCreateDefaultInput(
    host: HTMLElement,
    context: BasicFieldRenderContext
  ): HTMLInputElement {
    const inputType = context.field.dataType === 'boolean'
      ? 'checkbox'
      : this.getNativeInputType(context.field.dataType);
    const currentInput = host.firstElementChild;
    if (
      host.childElementCount === 1
      && currentInput instanceof HTMLInputElement
      && currentInput.type === inputType
    ) {
      return currentInput;
    }
    const input = this.createDefaultInput(inputType);
    host.replaceChildren(input);
    return input;
  }

  /** 创建只绑定一次事件监听器的原生输入控件。 */
  private createDefaultInput(inputType: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = inputType;
    input.addEventListener('change', () => this.handleDefaultInputChange(input));
    input.addEventListener('input', () => this.handleDefaultInput(input));
    return input;
  }

  /** 将最新字段值和状态同步到现有原生输入控件。 */
  private updateDefaultInput(
    input: HTMLInputElement,
    context: BasicFieldRenderContext
  ): void {
    this.fieldContexts.set(input, context);
    input.disabled = context.disabled;
    if (context.field.dataType === 'boolean') {
      input.className = 'form-easy-h5-boolean';
      input.setAttribute('role', 'switch');
      input.checked = Boolean(context.value);
      return;
    }
    input.className = '';
    input.removeAttribute('role');
    const value = String(context.value ?? '');
    if (input.value !== value) input.value = value;
  }

  /** 将 form-easy 数据类型映射为原生 input type。 */
  private getNativeInputType(
    dataType: BasicFieldRenderContext['field']['dataType']
  ): string {
    if (dataType === 'datetime') return 'datetime-local';
    return dataType === 'string' || !dataType ? 'text' : dataType;
  }

  /** 将 Web Component 自定义事件值交给最新的字段上下文处理。 */
  private handleComponentChange(component: HTMLElement, event: Event): void {
    if (!(event instanceof CustomEvent)) return;
    this.fieldContexts.get(component)?.onChange(event.detail);
  }

  /** 处理复选框或开关类型原生输入控件的值变化。 */
  private handleDefaultInputChange(input: HTMLInputElement): void {
    const context = this.fieldContexts.get(input);
    if (!context || context.field.dataType !== 'boolean') return;
    context.onChange(input.checked);
  }

  /** 处理文本、数字和日期等原生输入控件的实时值变化。 */
  private handleDefaultInput(input: HTMLInputElement): void {
    const context = this.fieldContexts.get(input);
    if (!context || context.field.dataType === 'boolean') return;
    context.onChange(
      context.field.dataType === 'number'
        ? Number(input.value)
        : input.value
    );
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
}> = [
  { name: 'select', component: { tagName: 'form-easy-select' } },
  { name: 'upload', component: { tagName: 'form-easy-upload' } }
];

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
