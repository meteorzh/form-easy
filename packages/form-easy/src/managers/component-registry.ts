import {
  defaultBasicFieldComponents,
  defaultH5BasicFieldRenderer
} from '../renderers/h5-basic-field-renderer';
import type { RegisteredComponent } from './component-registry-core';

export {
  ComponentRegistry,
  type RegisteredComponent
} from './component-registry-core';

/** 默认 H5 渲染器使用的组件注册中心。 */
export const componentRegistry = defaultH5BasicFieldRenderer.componentRegistry;

/** 默认 H5 渲染器自动注册的常用基础字段组件。 */
export { defaultBasicFieldComponents };

/** 为默认 H5 渲染器注册额外的自定义元素组件。 */
export function registerExtraBasicFieldComponent(
  name: string,
  component: RegisteredComponent
): void {
  componentRegistry.register(name, component);
}

/** 从默认 H5 渲染器中卸载额外的自定义元素组件。 */
export function unregisterExtraBasicFieldComponent(name: string): void {
  componentRegistry.unregister(name);
}
