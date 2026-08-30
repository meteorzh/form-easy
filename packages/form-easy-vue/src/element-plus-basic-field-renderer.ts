import { defineComponent, h, type Component, type PropType } from 'vue';
import {
  createVueBasicFieldRenderer,
  type VueBasicFieldRenderer
} from './basic-field-renderer';

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
}

/** Element Plus 字段适配组件的通用属性定义。 */
const fieldComponentProps = {
  /** 由 form-easy 传入的字段值。 */
  modelValue: {
    type: null as unknown as PropType<unknown>,
    default: null
  },
  /** 字段是否禁用。 */
  disabled: {
    type: Boolean,
    default: false
  }
};

/** 过滤渲染器同时传入的 value，避免与 modelValue 重复绑定。 */
function getForwardedAttributes(attributes: Record<string, unknown>): Record<string, unknown> {
  const { value: _value, ...forwardedAttributes } = attributes;
  return forwardedAttributes;
}

/** 创建 Element Plus 文本输入框适配器。 */
function createInputField(component: Component): Component {
  return defineComponent({
    name: 'FormEasyElementInputField',
    inheritAttrs: false,
    props: fieldComponentProps,
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () => h(component, {
        ...getForwardedAttributes(attrs),
        modelValue: String(props.modelValue ?? ''),
        disabled: props.disabled,
        'onUpdate:modelValue': (value: unknown) => emit('update:modelValue', value)
      });
    }
  });
}

/** 创建 Element Plus 数字输入框适配器。 */
function createInputNumberField(component: Component): Component {
  return defineComponent({
    name: 'FormEasyElementInputNumberField',
    inheritAttrs: false,
    props: fieldComponentProps,
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () => h(component, {
        ...getForwardedAttributes(attrs),
        modelValue: typeof props.modelValue === 'number' ? props.modelValue : undefined,
        disabled: props.disabled,
        'onUpdate:modelValue': (value: unknown) => emit('update:modelValue', value)
      });
    }
  });
}

/** 创建 Element Plus 开关适配器，将 null 等空值统一视为 false。 */
function createSwitchField(component: Component): Component {
  return defineComponent({
    name: 'FormEasyElementSwitchField',
    inheritAttrs: false,
    props: fieldComponentProps,
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () => h(component, {
        ...getForwardedAttributes(attrs),
        modelValue: Boolean(props.modelValue),
        disabled: props.disabled,
        'onUpdate:modelValue': (value: unknown) => emit('update:modelValue', value)
      });
    }
  });
}

/** 创建以字符串格式读写值的 Element Plus 日期选择适配器。 */
function createDatePickerField(component: Component, valueFormat: string): Component {
  return defineComponent({
    name: 'FormEasyElementDatePickerField',
    inheritAttrs: false,
    props: fieldComponentProps,
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () => h(component, {
        ...getForwardedAttributes(attrs),
        modelValue: typeof props.modelValue === 'string' ? props.modelValue : undefined,
        valueFormat,
        disabled: props.disabled,
        'onUpdate:modelValue': (value: unknown) => emit('update:modelValue', value)
      });
    }
  });
}

/** 创建以 HH:mm 字符串与 form-easy 交互的 Element Plus 时间选择适配器。 */
function createTimePickerField(component: Component): Component {
  return defineComponent({
    name: 'FormEasyElementTimePickerField',
    inheritAttrs: false,
    props: fieldComponentProps,
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () => h(component, {
        ...getForwardedAttributes(attrs),
        modelValue: typeof props.modelValue === 'string' ? props.modelValue : undefined,
        valueFormat: 'HH:mm',
        disabled: props.disabled,
        'onUpdate:modelValue': (value: unknown) => emit('update:modelValue', value)
      });
    }
  });
}

/**
 * 创建独立的 Element Plus 基础字段渲染器。
 *
 * form-easy-vue 不依赖 element-plus；调用方负责安装 Element Plus、导入组件和样式，
 * 再通过此方法传入需要使用的组件。
 */
export function createElementPlusBasicFieldRenderer(
  components: ElementPlusFieldComponents
): VueBasicFieldRenderer {
  const renderer = createVueBasicFieldRenderer();
  renderer.registerFieldComponent('elementInput', createInputField(components.input));
  renderer.registerFieldComponent(
    'elementInputNumber',
    createInputNumberField(components.inputNumber)
  );
  renderer.registerFieldComponent('elementSwitch', createSwitchField(components.switch));
  renderer.registerFieldComponent(
    'elementDatePicker',
    createDatePickerField(components.datePicker, 'YYYY-MM-DD')
  );
  renderer.registerFieldComponent(
    'elementDateTimePicker',
    createDatePickerField(components.datePicker, 'YYYY-MM-DD[T]HH:mm')
  );
  renderer.registerFieldComponent(
    'elementTimePicker',
    createTimePickerField(components.timePicker)
  );
  return renderer;
}
