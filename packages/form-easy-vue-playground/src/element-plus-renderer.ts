import {
  ElDatePicker,
  ElInput,
  ElInputNumber,
  ElSwitch,
  ElTimePicker
} from 'element-plus';
import { createVueBasicFieldRenderer } from 'form-easy-vue';

/** Element Plus 专用渲染器，仅影响显式传入该实例的 form-easy 表单。 */
export const elementPlusRenderer = createVueBasicFieldRenderer();

/** 注册 Element Plus 的常用基础字段组件。 */
elementPlusRenderer.registerFieldComponent('elementInput', ElInput);
elementPlusRenderer.registerFieldComponent('elementInputNumber', ElInputNumber);
elementPlusRenderer.registerFieldComponent('elementSwitch', ElSwitch);
elementPlusRenderer.registerFieldComponent('elementDatePicker', ElDatePicker);
elementPlusRenderer.registerFieldComponent('elementTimePicker', ElTimePicker);
