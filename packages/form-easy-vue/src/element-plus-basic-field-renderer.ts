import {
  ElDatePicker,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTimePicker
} from 'element-plus';
import {
  createVueBasicFieldRenderer,
  type VueBasicFieldRenderer
} from './basic-field-renderer';
import {
  createElementDatePickerField,
  createElementInputField,
  createElementInputNumberField,
  createElementSelectField,
  createElementSwitchField,
  createElementTimePickerField
} from './element/element-plus-field-components';

/**
 * 创建拥有 Element Plus 常用组件的独立基础字段渲染器。
 *
 * 调用方只需安装 element-plus 并引入其样式，无需重复传入 ElInput、ElSelect 等组件。
 */
export function createElementPlusBasicFieldRenderer(): VueBasicFieldRenderer {
  const renderer = createVueBasicFieldRenderer();
  renderer.registerFieldComponent('input', createElementInputField(ElInput));
  renderer.registerFieldComponent(
    'input-number',
    createElementInputNumberField(ElInputNumber)
  );
  renderer.registerFieldComponent('bool', createElementSwitchField(ElSwitch));
  renderer.registerFieldComponent(
    'date',
    createElementDatePickerField(ElDatePicker, 'YYYY-MM-DD')
  );
  renderer.registerFieldComponent(
    'datetime',
    createElementDatePickerField(ElDatePicker, 'YYYY-MM-DD[T]HH:mm')
  );
  renderer.registerFieldComponent(
    'time',
    createElementTimePickerField(ElTimePicker)
  );
  renderer.registerFieldComponent('select', createElementSelectField(ElSelect, ElOption));
  return renderer;
}

/** 预注册 Element Plus 常用组件的默认渲染器实例。 */
export const defaultElementPlusBasicFieldRenderer =
  createElementPlusBasicFieldRenderer();

/** 获取默认 Element Plus 基础字段渲染器。 */
export function getDefaultElementPlusBasicFieldRenderer(): VueBasicFieldRenderer {
  return defaultElementPlusBasicFieldRenderer;
}
