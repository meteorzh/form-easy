import type { DefineComponent } from 'vue';

export {
  installVueBasicFieldRenderer,
  getVueBasicFieldRenderer,
  registerVueFieldComponent,
  uninstallVueBasicFieldRenderer,
  unregisterVueFieldComponent
} from './basic-field-renderer';

/** form-easy 自定义元素在 Vue 中的类型安全视图。 */
export type FormEasyElement = HTMLElement & {
  schema: Record<string, unknown>;
};

export type FormEasyComponent = DefineComponent<{
  schema?: Record<string, unknown>;
}>;

export const FORM_EASY_TAG = 'form-easy';
