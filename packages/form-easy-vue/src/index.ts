import type { DefineComponent } from 'vue';

export {
  createVueBasicFieldRenderer,
  defaultVueFieldComponents,
  installVueBasicFieldRenderer,
  getVueBasicFieldRenderer,
  registerVueFieldComponent,
  uninstallVueBasicFieldRenderer,
  unregisterVueFieldComponent
} from './basic-field-renderer';

export { VueBasicFieldRenderer } from './basic-field-renderer';
export { VueSelect } from './basic/vue-select';
export { VueUpload } from './basic/vue-upload';
export {
  formEasyFieldPropOptions,
  useFormEasyField
} from './basic/use-form-easy-field';
export type {
  FormEasyFieldEmits,
  FormEasyFieldProps,
  UseFormEasyFieldResult
} from './basic/use-form-easy-field';

/** form-easy 自定义元素在 Vue 中的类型安全视图。 */
export type FormEasyElement = HTMLElement & {
  schema: Record<string, unknown>;
};

export type FormEasyComponent = DefineComponent<{
  schema?: Record<string, unknown>;
}>;

export const FORM_EASY_TAG = 'form-easy';
