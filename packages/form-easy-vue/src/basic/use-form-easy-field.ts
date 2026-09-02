import {
  computed,
  toRef,
  type ComputedRef,
  type PropType,
  type Ref
} from 'vue';
import type {
  EndpointKey,
  EndpointManager,
  FormField
} from 'form-easy';

/** form-easy 传给 Vue 自定义字段组件的通用属性。 */
export interface FormEasyFieldProps {
  /** 当前字段值。 */
  modelValue: unknown;
  /** 当前字段是否禁用。 */
  disabled: boolean;
  /** 由组件数据管理器准备完成的组件数据。 */
  componentData?: unknown;
  /** 当前字段可调用异步服务的端点管理器。 */
  endpointManager?: EndpointManager;
  /** 当前字段配置。 */
  field: FormField;
  /** 当前字段完整唯一标识。 */
  fieldId: string;
  /** 当前所属表单键。 */
  formKey: string;
}

/** Vue Options API 组件可复用的 form-easy 字段属性运行时声明。 */
export const formEasyFieldPropOptions = {
  /** 当前字段值。 */
  modelValue: { type: null as unknown as PropType<unknown>, default: null },
  /** 当前字段是否禁用。 */
  disabled: { type: Boolean, default: false },
  /** 由组件数据管理器准备完成的组件数据。 */
  componentData: { type: null as unknown as PropType<unknown>, default: undefined },
  /** 当前字段可调用异步服务的端点管理器。 */
  endpointManager: { type: null as unknown as PropType<EndpointManager | undefined>, default: undefined },
  /** 当前字段配置。 */
  field: { type: null as unknown as PropType<FormField>, required: true },
  /** 当前字段完整唯一标识。 */
  fieldId: { type: String, required: true },
  /** 当前所属表单键。 */
  formKey: { type: String, required: true }
};

/** form-easy Vue 自定义字段组件必须支持的值更新事件。 */
export interface FormEasyFieldEmits {
  /** 向 form-easy 回传新的字段值。 */
  (event: 'update:modelValue', value: unknown): void;
}

/** Vue 自定义字段组件可复用的响应式字段上下文。 */
export interface UseFormEasyFieldResult<TValue> {
  /** 可双向读写的当前字段值。 */
  value: ComputedRef<TValue>;
  /** 当前字段禁用状态。 */
  disabled: Ref<boolean>;
  /** 当前字段组件数据。 */
  componentData: Ref<unknown>;
  /** 当前字段配置。 */
  field: Ref<FormField>;
  /** 当前字段完整唯一标识。 */
  fieldId: Ref<string>;
  /** 当前所属表单键。 */
  formKey: Ref<string>;
  /** 当前字段可调用异步服务的端点管理器。 */
  endpointManager: Ref<EndpointManager | undefined>;
  /** 向 form-easy 回传新的字段值。 */
  updateValue(value: TValue): void;
  /** 调用端点管理器中已注册的异步服务。 */
  invokeEndpoint<TInput, TResult>(
    endpointKey: EndpointKey,
    input: TInput,
    signal?: AbortSignal
  ): Promise<TResult>;
}

/**
 * 提供 Vue 自定义字段组件所需的标准值同步、字段上下文和端点调用能力。
 *
 * TValue 仅描述组件自身处理的值类型，form-easy 不会强制转换该值。
 */
export function useFormEasyField<TValue = unknown>(
  props: FormEasyFieldProps,
  emit: FormEasyFieldEmits
): UseFormEasyFieldResult<TValue> {
  /** 向 form-easy 回传新的字段值。 */
  const updateValue = (value: TValue): void => {
    emit('update:modelValue', value);
  };

  /** 使用端点管理器调用组件所需的异步服务。 */
  const invokeEndpoint = async <TInput, TResult>(
    endpointKey: EndpointKey,
    input: TInput,
    signal = new AbortController().signal
  ): Promise<TResult> => {
    if (!props.endpointManager) throw new Error('当前字段未配置可用的端点管理器。');
    return props.endpointManager.invoke<TInput, TResult>(endpointKey, {
      formKey: props.formKey,
      fieldId: props.fieldId,
      field: props.field,
      input,
      signal
    });
  };

  return {
    value: computed<TValue>({
      get: () => props.modelValue as TValue,
      set: updateValue
    }),
    disabled: toRef(props, 'disabled'),
    componentData: toRef(props, 'componentData'),
    field: toRef(props, 'field'),
    fieldId: toRef(props, 'fieldId'),
    formKey: toRef(props, 'formKey'),
    endpointManager: toRef(props, 'endpointManager'),
    updateValue,
    invokeEndpoint
  };
}
