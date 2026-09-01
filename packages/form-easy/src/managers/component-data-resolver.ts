import type { ComponentDataResolver } from '../types';

/** 跨打包入口共享组件数据解析器的全局 Symbol 键。 */
const COMPONENT_DATA_RESOLVER_KEY = Symbol.for('form-easy.component-data-resolver');

/** 保存全局组件数据解析器的对象类型。 */
type GlobalResolverStore = typeof globalThis & {
  /** 当前全局组件数据解析器。 */
  [COMPONENT_DATA_RESOLVER_KEY]?: ComponentDataResolver;
};

/** 全局组件数据解析器的存储对象。 */
const globalResolverStore = globalThis as GlobalResolverStore;

/** 注册全局组件数据解析器；传入 undefined 可清除当前解析器。 */
export function registerGlobalComponentDataResolver(resolver?: ComponentDataResolver): void {
  globalResolverStore[COMPONENT_DATA_RESOLVER_KEY] = resolver;
}

/** 获取已注册的全局组件数据解析器。 */
export function getGlobalComponentDataResolver(): ComponentDataResolver | undefined {
  return globalResolverStore[COMPONENT_DATA_RESOLVER_KEY];
}
