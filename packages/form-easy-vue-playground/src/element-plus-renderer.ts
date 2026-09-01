import {
  ElDatePicker,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTimePicker
} from 'element-plus';
import { createElementPlusBasicFieldRenderer } from 'form-easy-vue';

/** Playground 的 Element Plus 专用渲染器，由应用自行提供 Element Plus 组件。 */
export const elementPlusRenderer = createElementPlusBasicFieldRenderer({
  input: ElInput,
  inputNumber: ElInputNumber,
  switch: ElSwitch,
  datePicker: ElDatePicker,
  timePicker: ElTimePicker,
  select: ElSelect,
  option: ElOption
});
