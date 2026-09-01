/** 渲染已注册自定义组件所需的元信息。 */
export interface RegisteredComponent {
  /** 自定义元素标签名。 */
  tagName: string;
}

/** 供表单渲染器解析配置组件名称的泛型注册中心。 */
export class ComponentRegistry<T> {
  /** 按 schema 组件名称索引的已注册组件。 */
  private readonly components = new Map<string, T>();

  /** 注册或替换一个组件值。 */
  register(name: string, component: T): void {
    this.components.set(name, component);
  }

  /** 获取 schema 组件名称对应的已注册组件值。 */
  get(name: string | undefined): T | undefined {
    return name ? this.components.get(name) : undefined;
  }

  /** 移除一个组件注册。 */
  unregister(name: string): void {
    this.components.delete(name);
  }
}

/** form-easy 默认 H5 渲染逻辑使用的组件注册中心。 */
export const componentRegistry = new ComponentRegistry<RegisteredComponent>();

/** 核心包内置并会在初始化时自动注册的常用基础字段组件。 */
export const defaultBasicFieldComponents: ReadonlyArray<{
  /** schema 中使用的组件名称。 */
  name: string;
  /** 对应的 Web Component 注册信息。 */
  component: RegisteredComponent;
}> = [
  {
    name: 'select',
    component: { tagName: 'form-easy-select' }
  }
];

/** 将内置基础字段组件预注册到默认 H5 组件注册中心。 */
defaultBasicFieldComponents.forEach(({ name, component }) => {
  componentRegistry.register(name, component);
});

/** 为默认 H5 渲染逻辑注册额外的自定义元素组件。 */
export function registerExtraBasicFieldComponent(
  name: string,
  component: RegisteredComponent
): void {
  componentRegistry.register(name, component);
}

/** 从默认 H5 渲染逻辑中卸载额外的自定义元素组件。 */
export function unregisterExtraBasicFieldComponent(name: string): void {
  componentRegistry.unregister(name);
}
