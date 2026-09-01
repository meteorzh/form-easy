import type { Component } from 'vue';
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

/** 创建 Element Plus 渲染器时由使用方提供的组件集合。 */
export interface ElementPlusFieldComponents {
  /** 文本输入组件，通常传入 ElInput。 */
  input: Component;
  /** 数字输入组件，通常传入 ElInputNumber。 */
  inputNumber: Component;
  /** 开关组件，通常传入 ElSwitch。 */
  switch: Component;
  /** 日期与日期时间选择组件，通常传入 ElDatePicker。 */
  datePicker: Component;
  /** 时间选择组件，通常传入 ElTimePicker。 */
  timePicker: Component;
  /** 下拉选择组件，通常传入 ElSelect；与 option 同时提供时注册 select。 */
  select?: Component;
  /** 下拉选项组件，通常传入 ElOption；与 select 同时提供时注册 select。 */
  option?: Component;
}

/** 创建独立的 Element Plus 基础字段渲染器。 */
export function createElementPlusBasicFieldRenderer(
  components: ElementPlusFieldComponents
): VueBasicFieldRenderer {
  const renderer = createVueBasicFieldRenderer();
  renderer.registerFieldComponent(
    'elementInput',
    createElementInputField(components.input)
  );
  renderer.registerFieldComponent(
    'elementInputNumber',
    createElementInputNumberField(components.inputNumber)
  );
  renderer.registerFieldComponent(
    'elementSwitch',
    createElementSwitchField(components.switch)
  );
  renderer.registerFieldComponent(
    'elementDatePicker',
    createElementDatePickerField(components.datePicker, 'YYYY-MM-DD')
  );
  renderer.registerFieldComponent(
    'elementDateTimePicker',
    createElementDatePickerField(components.datePicker, 'YYYY-MM-DD[T]HH:mm')
  );
  renderer.registerFieldComponent(
    'elementTimePicker',
    createElementTimePickerField(components.timePicker)
  );
  if (components.select && components.option) {
    renderer.registerFieldComponent(
      'select',
      createElementSelectField(components.select, components.option)
    );
  }
  return renderer;
}
