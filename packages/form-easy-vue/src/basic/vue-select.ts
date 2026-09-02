import { defineComponent, h } from 'vue';
import {
  formEasyFieldPropOptions,
  useFormEasyField,
  type FormEasyFieldProps
} from './use-form-easy-field';

/** Vue 默认下拉组件支持的单个选项。 */
interface VueSelectOption {
  /** 选项展示文本。 */
  label: string;
  /** 选项实际值。 */
  value: string | number;
  /** 是否禁用当前选项。 */
  disabled?: boolean;
}

/** 使用 componentData 渲染原生 select 的 Vue 基础组件。 */
export const VueSelect = defineComponent({
  name: 'FormEasyVueSelect',
  inheritAttrs: false,
  props: {
    ...formEasyFieldPropOptions,
    /** 未选择值时展示的占位文本。 */
    placeholder: { type: String, default: '请选择' }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const { value, disabled, componentData, updateValue } = useFormEasyField<unknown>(
      props as FormEasyFieldProps,
      emit
    );
    /** 判断组件数据是否为合法的下拉选项数组。 */
    const isSelectOption = (value: unknown): value is VueSelectOption => {
      if (!value || typeof value !== 'object') return false;
      const option = value as Record<string, unknown>;
      return typeof option.label === 'string'
        && (typeof option.value === 'string' || typeof option.value === 'number')
        && (option.disabled === undefined || typeof option.disabled === 'boolean');
    };

    /** 将当前组件数据安全转换为选项数组。 */
    const getOptions = (): VueSelectOption[] => {
      return Array.isArray(componentData.value) && componentData.value.every(isSelectOption)
        ? componentData.value
        : [];
    };

    /** 将选择的字符串值映射回原始选项值类型。 */
    const handleChange = (event: Event): void => {
      const selectedValue = (event.target as HTMLSelectElement).value;
      const selectedOption = getOptions().find(option => String(option.value) === selectedValue);
      if (selectedOption) updateValue(selectedOption.value);
    };

    return () => {
      const options = getOptions();
      const currentValue = String(value.value ?? '');
      const hasSelectedValue = options.some(option => String(option.value) === currentValue);
      return h('select', { disabled: disabled.value, onChange: handleChange }, [
        h('option', { value: '', disabled: true, selected: !hasSelectedValue }, props.placeholder),
        ...options.map(option => h('option', {
          value: String(option.value),
          disabled: option.disabled,
          selected: String(option.value) === currentValue
        }, option.label))
      ]);
    };
  }
});
