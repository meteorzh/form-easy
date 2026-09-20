import type { DefineComponent } from 'vue';
import type { App } from 'vue';

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
export { FormEasy } from './components/form-easy';
export { FormEasyCreator } from './components/form-easy-creator';
import { FormEasy } from './components/form-easy';
import { FormEasyCreator } from './components/form-easy-creator';
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

/** 将 form-easy 的两个 Vue 入口组件注册到应用实例。 */
export const installFormEasyVue = {
  install(app: App): void {
    app.component('FormEasy', FormEasy);
    app.component('FormEasyCreator', FormEasyCreator);
  }
};
