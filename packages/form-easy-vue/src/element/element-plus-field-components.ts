import { defineComponent, h, type Component, type PropType } from 'vue';

/** Element Plus 字段适配组件的通用属性定义。 */
const fieldComponentProps = {
  /** 由 form-easy 传入的字段值。 */
  modelValue: { type: null as unknown as PropType<unknown>, default: null },
  /** 字段是否禁用。 */
  disabled: { type: Boolean, default: false }
};

/** 过滤不属于 Element Plus 基础组件的通用渲染属性。 */
function getForwardedAttributes(attributes: Record<string, unknown>): Record<string, unknown> {
  const { value: _value, componentData: _componentData, ...forwardedAttributes } = attributes;
  return forwardedAttributes;
}

/** 创建 Element Plus 文本输入框适配器。 */
export function createElementInputField(component: Component): Component {
  return createValueField('FormEasyElementInputField', component, value => String(value ?? ''));
}

/** 创建 Element Plus 数字输入框适配器。 */
export function createElementInputNumberField(component: Component): Component {
  return createValueField('FormEasyElementInputNumberField', component, value => typeof value === 'number' ? value : undefined);
}

/** 创建 Element Plus 开关适配器。 */
export function createElementSwitchField(component: Component): Component {
  return createValueField('FormEasyElementSwitchField', component, value => Boolean(value));
}

/** 创建以字符串格式读写值的 Element Plus 日期选择适配器。 */
export function createElementDatePickerField(component: Component, valueFormat: string): Component {
  return createValueField('FormEasyElementDatePickerField', component, value => typeof value === 'string' ? value : undefined, { valueFormat });
}

/** 创建以 HH:mm 字符串读写值的 Element Plus 时间选择适配器。 */
export function createElementTimePickerField(component: Component): Component {
  return createValueField('FormEasyElementTimePickerField', component, value => typeof value === 'string' ? value : undefined, { valueFormat: 'HH:mm' });
}

/** 创建只负责模型值适配的 Element Plus 字段组件。 */
function createValueField(
  name: string,
  component: Component,
  resolveValue: (value: unknown) => unknown,
  extraProperties: Record<string, unknown> = {}
): Component {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: fieldComponentProps,
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () => h(component, {
        ...getForwardedAttributes(attrs),
        ...extraProperties,
        modelValue: resolveValue(props.modelValue),
        disabled: props.disabled,
        'onUpdate:modelValue': (value: unknown) => emit('update:modelValue', value)
      });
    }
  });
}

/** Element Plus 下拉组件支持的单个选项。 */
interface ElementSelectOption {
  /** 选项展示文本。 */
  label: string;
  /** 选项实际值。 */
  value: string | number;
  /** 是否禁用当前选项。 */
  disabled?: boolean;
}

/** 创建使用 componentData 渲染 ElSelect 与 ElOption 的适配器。 */
export function createElementSelectField(selectComponent: Component, optionComponent: Component): Component {
  return defineComponent({
    name: 'FormEasyElementSelectField',
    inheritAttrs: false,
    props: {
      ...fieldComponentProps,
      /** 由 form-easy 组件数据机制提供的选项数组。 */
      componentData: { type: null as unknown as PropType<unknown>, default: undefined }
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      const isSelectOption = (value: unknown): value is ElementSelectOption => {
        if (!value || typeof value !== 'object') return false;
        const option = value as Record<string, unknown>;
        return typeof option.label === 'string'
          && (typeof option.value === 'string' || typeof option.value === 'number')
          && (option.disabled === undefined || typeof option.disabled === 'boolean');
      };
      const getOptions = (): ElementSelectOption[] => {
        const componentData = props.componentData as unknown;
        return Array.isArray(componentData) && componentData.every(isSelectOption) ? componentData : [];
      };
      return () => h(selectComponent, {
        ...getForwardedAttributes(attrs),
        modelValue: props.modelValue,
        disabled: props.disabled,
        'onUpdate:modelValue': (value: unknown) => emit('update:modelValue', value)
      }, {
        default: () => getOptions().map(option => h(optionComponent, {
          key: String(option.value), label: option.label, value: option.value, disabled: option.disabled
        }))
      });
    }
  });
}
