import type { DefineComponent } from 'vue';

export {
  createVueBasicFieldRenderer,
  installVueBasicFieldRenderer,
  getVueBasicFieldRenderer,
  registerVueFieldComponent,
  uninstallVueBasicFieldRenderer,
  unregisterVueFieldComponent
} from './basic-field-renderer';

export type { VueBasicFieldRenderer } from './basic-field-renderer';
export { defaultVueFieldComponents } from './basic/default-components';

export { createElementPlusBasicFieldRenderer } from './element-plus-basic-field-renderer';
export type { ElementPlusFieldComponents } from './element-plus-basic-field-renderer';

/** form-easy 自定义元素在 Vue 中的类型安全视图。 */
export type FormEasyElement = HTMLElement & {
  schema: Record<string, unknown>;
};

export type FormEasyComponent = DefineComponent<{
  schema?: Record<string, unknown>;
}>;

export const FORM_EASY_TAG = 'form-easy';
