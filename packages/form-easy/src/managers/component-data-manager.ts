import type {
  ComponentDataKey,
  ComponentDataResolver,
  ComponentDataResolverContext,
  ComponentDataResolverParams
} from '../types';

/** 按组件数据键管理异步数据加载函数的注册中心。 */
export class ComponentDataManager {
  /** 已注册的组件数据加载函数。 */
  private readonly resolvers = new Map<ComponentDataKey, ComponentDataResolver>();
  /** 按组件数据键和参数缓存已经成功解析的数据。 */
  private readonly resolvedDataCache = new Map<string, unknown>();

  /** 注册或替换指定组件数据键的加载函数。 */
  register(componentDataKey: ComponentDataKey, resolver: ComponentDataResolver): void {
    this.clearCache(componentDataKey);
    this.resolvers.set(componentDataKey, resolver);
  }

  /** 移除指定组件数据键的加载函数。 */
  unregister(componentDataKey: ComponentDataKey): void {
    this.clearCache(componentDataKey);
    this.resolvers.delete(componentDataKey);
  }

  /** 清理全部缓存，或只清理指定组件数据键的缓存。 */
  clearCache(componentDataKey?: ComponentDataKey): void {
    if (componentDataKey === undefined) {
      this.resolvedDataCache.clear();
      return;
    }
    const keyPrefix = `${componentDataKey}\u0000`;
    Array.from(this.resolvedDataCache.keys())
      .filter(cacheKey => cacheKey.startsWith(keyPrefix))
      .forEach(cacheKey => this.resolvedDataCache.delete(cacheKey));
  }

  /** 加载指定组件数据键的数据，未注册时抛出明确错误。 */
  async resolve(
    componentDataKey: ComponentDataKey,
    context: Omit<ComponentDataResolverContext, 'componentDataKey'>,
    params: ComponentDataResolverParams = {}
  ): Promise<unknown> {
    const resolver = this.resolvers.get(componentDataKey);
    if (!resolver) throw new Error(`未找到组件数据键“${componentDataKey}”的加载函数。`);
    const cacheKey = createComponentDataCacheKey(componentDataKey, params);
    if (cacheKey !== undefined && this.resolvedDataCache.has(cacheKey)) {
      return this.resolvedDataCache.get(cacheKey);
    }

    const componentData = await resolver({ ...context, componentDataKey }, params);
    if (cacheKey !== undefined) this.resolvedDataCache.set(cacheKey, componentData);
    return componentData;
  }
}

/** 创建稳定的组件数据缓存键；无法安全序列化的参数不参与缓存。 */
function createComponentDataCacheKey(
  componentDataKey: ComponentDataKey,
  params: ComponentDataResolverParams
): string | undefined {
  const serializedParams = serializeCacheValue(params, new Set<object>());
  return serializedParams === undefined
    ? undefined
    : `${componentDataKey}\u0000${serializedParams}`;
}

/** 稳定序列化缓存参数，确保对象属性顺序不影响缓存命中。 */
function serializeCacheValue(value: unknown, ancestors: Set<object>): string | undefined {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'number:NaN';
    if (value === Infinity) return 'number:Infinity';
    if (value === -Infinity) return 'number:-Infinity';
    return `number:${String(value)}`;
  }
  if (typeof value === 'bigint') return `bigint:${String(value)}`;
  if (typeof value !== 'object') return undefined;
  if (ancestors.has(value)) return undefined;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : `date:${value.toISOString()}`;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
    return undefined;
  }

  ancestors.add(value);
  let serialized: string | undefined;
  if (Array.isArray(value)) {
    const items = value.map(item => serializeCacheValue(item, ancestors));
    serialized = items.every(item => item !== undefined)
      ? `[${items.join(',')}]`
      : undefined;
  } else {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map(key => {
        const item = serializeCacheValue(
          (value as Record<string, unknown>)[key],
          ancestors
        );
        return item === undefined ? undefined : `${JSON.stringify(key)}:${item}`;
      });
    serialized = entries.every(entry => entry !== undefined)
      ? `{${entries.join(',')}}`
      : undefined;
  }
  ancestors.delete(value);
  return serialized;
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
