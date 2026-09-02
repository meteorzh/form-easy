import type {
  ComponentDataKey,
  ComponentDataResolver,
  ComponentDataResolverContext
} from '../types';

/** 按组件数据键管理异步数据加载函数的注册中心。 */
export class ComponentDataManager {
  /** 已注册的组件数据加载函数。 */
  private readonly resolvers = new Map<ComponentDataKey, ComponentDataResolver>();

  /** 注册或替换指定组件数据键的加载函数。 */
  register(componentDataKey: ComponentDataKey, resolver: ComponentDataResolver): void {
    this.resolvers.set(componentDataKey, resolver);
  }

  /** 移除指定组件数据键的加载函数。 */
  unregister(componentDataKey: ComponentDataKey): void {
    this.resolvers.delete(componentDataKey);
  }

  /** 加载指定组件数据键的数据，未注册时抛出明确错误。 */
  async resolve(
    componentDataKey: ComponentDataKey,
    context: Omit<ComponentDataResolverContext, 'componentDataKey'>
  ): Promise<unknown> {
    const resolver = this.resolvers.get(componentDataKey);
    if (!resolver) throw new Error(`未找到组件数据键“${componentDataKey}”的加载函数。`);
    return resolver({ ...context, componentDataKey });
  }
}

/** 跨打包入口共享组件数据管理器的全局 Symbol 键。 */
const COMPONENT_DATA_MANAGER_KEY = Symbol.for('form-easy.component-data-manager');

/** 可通过 Symbol 键保存运行时对象的全局对象类型。 */
const globalComponentDataManagerStore = globalThis as { [key: symbol]: unknown };

/** 注册全局组件数据管理器；传入 undefined 可取消全局配置。 */
export function registerGlobalComponentDataManager(
  componentDataManager?: ComponentDataManager
): void {
  globalComponentDataManagerStore[COMPONENT_DATA_MANAGER_KEY] = componentDataManager;
}

/** 获取当前全局组件数据管理器。 */
export function getGlobalComponentDataManager(): ComponentDataManager | undefined {
  return globalComponentDataManagerStore[COMPONENT_DATA_MANAGER_KEY] as ComponentDataManager | undefined;
}
