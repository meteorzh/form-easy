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
