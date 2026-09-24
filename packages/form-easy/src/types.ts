import type {
  ComponentDataKey,
  ComponentHandle,
  EventFlowHistory,
  FormField,
  FormFieldDefinition,
  NamedFormFieldNode
} from './form-field-types';

export * from './form-field-types';

/** 表单字段标签相对于编辑器的显示位置。 */
export type LabelPosition = 'left' | 'top' | 'right';

/** 内置异步服务的固定端点键。 */
export type DefaultEndpointKey = 'upload';

/**
 * 异步服务端点键。
 *
 * 内置键可获得代码补全，同时允许业务方使用任意自定义字符串。
 */
export type EndpointKey = DefaultEndpointKey | (string & {});

/** 字段校验错误的来源类型。 */
export type FieldValidationErrorType = 'value' | 'configuration' | 'component';

/** 基础字段组件向字段容器报告的内部校验结果。 */
export interface ComponentValidationResult {
  /** 组件当前内部状态是否有效。 */
  valid: boolean;
  /** 组件内部状态无效时面向用户展示的错误信息。 */
  message?: string;
}

/** 单个字段执行同步校验后的结果。 */
export interface FieldValidationResult {
  /** 当前字段值是否通过全部规则。 */
  valid: boolean;
  /** 校验失败来源于字段值、schema 配置还是渲染组件。 */
  errorType?: FieldValidationErrorType;
  /** 首个未通过的规则类型。 */
  ruleType?: import('./form-field-types').FieldValidationRuleType;
  /** 首个未通过规则对应的错误信息。 */
  message?: string;
}

/** 组件数据解析器执行时携带的上下文。 */
export interface ComponentDataResolverContext {
  /** 当前字段的组件数据键。 */
  componentDataKey: ComponentDataKey;
  /** 当前字段配置。 */
  field: FormField;
  /** 当前字段完整唯一标识。 */
  fieldId: string;
  /** 当前所属表单键。 */
  formKey: string;
  /** 用于取消过期异步请求的信号。 */
  signal: AbortSignal;
}

/** 调用组件数据解析器时传入的命名参数。 */
export type ComponentDataResolverParams = Readonly<Record<string, unknown>>;

/** 根据字段配置加载组件数据的函数。 */
export type ComponentDataResolver = (
  context: ComponentDataResolverContext,
  params: ComponentDataResolverParams
) => unknown | Promise<unknown>;

/** 描述完整的动态表单。 */
export interface FormSchema {
  /** 全局有意义的表单键。 */
  key: string;
  /** 可选的表单标题；未配置时不渲染标题区域。 */
  name?: string;
  /** 字段标签位置；未配置时默认使用 left。 */
  labelPosition?: LabelPosition;
  /** 可通过 $ref 按需引用的字段模板。 */
  definitions?: Record<string, FormFieldDefinition>;
  /** 顶层字段定义或引用列表。 */
  fields: NamedFormFieldNode[];
}

/** 字段值变更时触发的事件载荷。 */
export interface FormChangeDetail {
  /** 字段唯一标识。 */
  fieldId: string;
  /** 变更后的字段值。 */
  value: unknown;
  /** 变更后的完整表单数据。 */
  formData: Record<string, unknown>;
}

/** 字段可见状态变化时触发的内部事件载荷。 */
export interface FieldVisibilityChangeDetail {
  /** 字段完整唯一标识。 */
  fieldId: string;
  /** 字段当前是否可见。 */
  visible: boolean;
  /** 字段当前是否仍挂载在表单中。 */
  connected: boolean;
  /** 当前可见状态是否会影响字段的对外输出。 */
  affectsOutput: boolean;
}

/** 字段输出存在状态变化时触发的内部事件载荷。 */
export interface FieldPresenceChangeDetail {
  /** 字段完整唯一标识。 */
  fieldId: string;
  /** 当前字段是否应存在于最终输出对象中。 */
  present: boolean;
  /** 字段当前是否仍挂载在表单中。 */
  connected: boolean;
}

/** 可渲染字段控件需要实现的约定。 */
export interface HandleTarget {
  /** 对控件执行 form-easy 操作命令，并携带当前事件流历史。 */
  applyHandle(handle: ComponentHandle, value?: unknown, history?: EventFlowHistory): void;
}
