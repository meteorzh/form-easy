import { defineComponent, h, ref, type Component, type PropType } from 'vue';
import type { EndpointManager, FormField } from 'form-easy';

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

/** 创建使用 Element Plus 上传组件和按钮以及端点管理器的适配器。 */
export function createElementUploadField(
  uploadComponent: Component,
  buttonComponent: Component
): Component {
  return defineComponent({
    name: 'FormEasyElementUploadField',
    inheritAttrs: false,
    props: {
      ...fieldComponentProps,
      /** 当前字段可调用异步服务的端点管理器。 */
      endpointManager: { type: null as unknown as PropType<EndpointManager | undefined>, default: undefined },
      /** 当前字段配置。 */
      field: { type: null as unknown as PropType<FormField>, required: true },
      /** 当前字段完整唯一标识。 */
      fieldId: { type: String, required: true },
      /** 当前所属表单键。 */
      formKey: { type: String, required: true }
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      /** 当前本轮上传完成的 URL，用于多文件值汇总。 */
      const completedUrls = ref<string[]>([]);

      /** 从已有字段值读取 URL 列表。 */
      const getExistingUrls = (): string[] => {
        const modelValue = props.modelValue as unknown;
        if (typeof modelValue !== 'string' || modelValue.length === 0) return [];
        if (!(attrs.multiple === '' || attrs.multiple === true || attrs.multiple === 'true')) {
          return [modelValue];
        }
        try {
          const urls = JSON.parse(modelValue);
          return Array.isArray(urls) && urls.every(url => typeof url === 'string') ? urls : [];
        } catch {
          return [];
        }
      };

      /** 交由端点管理器执行实际文件上传，并返回 URL 给 ElUpload。 */
      const httpRequest = async (request: { file: File }): Promise<string> => {
        if (!props.endpointManager) throw new Error('未配置可用的端点管理器。');
        const result = await props.endpointManager.invoke<File, unknown>(
          'upload',
          {
            formKey: props.formKey,
            fieldId: props.fieldId,
            field: props.field,
            input: request.file,
            signal: new AbortController().signal
          }
        );
        if (typeof result !== 'string') throw new Error('上传端点必须返回文件 URL 字符串。');
        return result;
      };

      /** 上传成功后将返回 URL 转换为字段约定值。 */
      const handleSuccess = (url: unknown): void => {
        if (typeof url !== 'string') return;
        const multiple = attrs.multiple === '' || attrs.multiple === true || attrs.multiple === 'true';
        if (!multiple) {
          completedUrls.value = [url];
          emit('update:modelValue', url);
          return;
        }
        const existingUrls = completedUrls.value.length > 0
          ? completedUrls.value
          : getExistingUrls();
        completedUrls.value = [...existingUrls, url];
        emit('update:modelValue', JSON.stringify(completedUrls.value));
      };

      /** 渲染 Element Plus 上传组件，并将上传请求交由 EndpointManager 执行。 */
      return () => h(uploadComponent, {
        ...getForwardedAttributes(attrs),
        disabled: props.disabled,
        autoUpload: true,
        httpRequest,
        onSuccess: handleSuccess
      }, {
        default: () => h(buttonComponent, {
          type: 'primary',
          disabled: props.disabled
        }, {
          default: () => '选择文件并上传'
        })
      });
    }
  });
}
