import type { Component } from 'vue';
import { DefaultVueSelect } from './default-select';

/** Vue 渲染器实例初始化时自动注册的常用字段组件。 */
export const defaultVueFieldComponents: ReadonlyArray<{
  /** schema 中使用的组件名称。 */
  name: string;
  /** 对应的 Vue 组件。 */
  component: Component;
}> = [
  { name: 'select', component: DefaultVueSelect }
];
