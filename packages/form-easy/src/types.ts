/** 表单结构支持的字段分类。 */
export type FieldCategory = 'basic' | 'array' | 'object' | 'record';

/** 表单字段标签相对于编辑器的显示位置。 */
export type LabelPosition = 'left' | 'top' | 'right';

/** 基础字段支持的数据类型。 */
export type DataType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'time';

/** 基础字段渲染器约定的内置组件键。 */
export type DefaultBasicFieldComponentKey =
  | 'input'
  | 'input-number'
  | 'bool'
  | 'date'
  | 'datetime'
  | 'time'
  | 'select';

/**
 * 基础字段组件注册键。
 *
 * 内置键可获得代码补全，同时允许业务方使用任意自定义字符串。
 */
export type BasicFieldComponentKey = DefaultBasicFieldComponentKey | (string & {});

/** 内置异步服务的固定端点键。 */
export type DefaultEndpointKey = 'upload';

/**
 * 异步服务端点键。
 *
 * 内置键可获得代码补全，同时允许业务方使用任意自定义字符串。
 */
export type EndpointKey = DefaultEndpointKey | (string & {});

/** 组件数据加载器的注册键，允许业务方使用任意字符串。 */
export type ComponentDataKey = string & {};

/** 第一阶段字段校验支持的规则类型。 */
export type FieldValidationRuleType =
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'pattern'
  | 'enum';

/** 字段校验错误的来源类型。 */
export type FieldValidationErrorType = 'value' | 'configuration';

/** 描述一个可序列化的同步字段校验规则。 */
export interface FieldValidationRule {
  /** 当前校验规则的类型。 */
  type: FieldValidationRuleType;
  /** 当前规则使用的比较值。 */
  value: unknown;
  /** 校验失败时展示的自定义错误信息。 */
  message?: string;
}

/** 单个字段执行同步校验后的结果。 */
export interface FieldValidationResult {
  /** 当前字段值是否通过全部规则。 */
  valid: boolean;
  /** 校验失败来源于字段值还是 schema 配置。 */
  errorType?: FieldValidationErrorType;
  /** 首个未通过的规则类型。 */
  ruleType?: FieldValidationRuleType;
  /** 首个未通过规则对应的错误信息。 */
  message?: string;
}

/** 数据类型未显式配置 component 时使用的默认组件键映射。 */
export const defaultBasicFieldComponentKeyByDataType: Readonly<Record<
  DataType,
  DefaultBasicFieldComponentKey
>> = {
  string: 'input',
  number: 'input-number',
  boolean: 'bool',
  date: 'date',
  datetime: 'datetime',
  time: 'time'
};

/** 获取数据类型对应的默认基础字段组件键。 */
export function getDefaultBasicFieldComponentKey(
  dataType?: DataType
): DefaultBasicFieldComponentKey {
  return defaultBasicFieldComponentKeyByDataType[dataType ?? 'string'];
}

/** 所有 form-easy 字段组件支持的操作命令。 */
export type ComponentHandle = 'show' | 'hide' | 'disable' | 'enable' | 'clear' | 'change';

/** 字段操作实际生效后触发的事件。 */
export type ComponentEventName = 'onShow' | 'onHide' | 'onDisabled' | 'onEnabled' | 'onClear' | 'onChange';

/** 当前事件流中已经触发过的事件唯一标识列表。 */
export type EventFlowHistory = readonly string[];

/** 当前字段支持绑定的目标属性。 */
export type BindingTarget = 'visible' | 'enable' | 'value';

/** 声明其他字段状态或值到当前字段的单向绑定。 */
export interface FieldBinding {
  /** 绑定源所属表单的键。 */
  sourceFormKey: string;
  /** 绑定源字段的完整唯一标识，或使用“./字段key”引用当前结构中的同级字段。 */
  sourceFieldId: string;
  /** 当前字段需要同步的目标属性。 */
  target: BindingTarget;
  /**
   * 将绑定源字段值转换为布尔值的 JavaScript 函数体。
   * 函数体仅可使用 sourceFieldValue 参数，并应使用 return 返回转换结果。
   */
  resolver?: string;
}

/** 声明其他字段的事件如何控制当前字段。 */
export interface EventSubscription {
  /** 事件源所属表单的键。 */
  sourceFormKey: string;
  /** 事件源字段的完整唯一标识。 */
  sourceFieldKey: string;
  /** 事件源字段触发的事件。 */
  eventName: ComponentEventName;
  /** 订阅目标字段需要执行的操作命令。 */
  handle: ComponentHandle;
}

/** 描述动态表单中的一个字段。 */
export interface FormField {
  /** 用于读写字段值的键；数组元素定义中不存在。 */
  key?: string;
  /** 面向用户展示的字段名称；数组元素定义中不存在。 */
  name?: string;
  /** 当前字段的渲染分类。 */
  category: FieldCategory;
  /** 当前字段是否必填。 */
  required?: boolean;
  /** 值为 null 或 undefined 时是否从父级输出对象中省略当前命名字段。 */
  omitNull?: boolean;
  /** 字段隐藏时是否从父级输出对象中省略当前命名字段。 */
  omitWhenHidden?: boolean;
  /** 当前字段按顺序执行的同步校验规则。 */
  rules?: FieldValidationRule[];
  /** 未提供运行时数据时使用的默认值。 */
  defaultValue?: unknown;
  /** 展示在字段名称旁的提示文本。 */
  hint?: string;
  /** 值的数据类型，仅适用于基础字段。 */
  dataType?: DataType;
  /** 优先于数据类型默认组件使用的已注册组件键。 */
  component?: BasicFieldComponentKey;
  /** 数组字段的元素定义或可复用字段定义引用。 */
  element?: FormArrayElementNode;
  /** 对象字段包含的子字段或可复用字段定义引用。 */
  fields?: FormFieldNode[];
  /** record 字段的动态键和值定义。 */
  kvDef?: FormRecordKeyValueDefinition;
  /** 透传给已注册自定义组件的属性。 */
  componentProperties?: Record<string, unknown>;
  /** 直接提供给组件的数据，优先于 componentDataKey。 */
  componentData?: unknown;
  /** 用于通过组件数据解析器加载数据的业务键或带字段参数的调用表达式。 */
  componentDataKey?: ComponentDataKey;
  /** 当前字段拥有的事件订阅配置。 */
  eventSubscriptions?: EventSubscription[];
  /** 当前字段拥有的单向绑定配置。 */
  binds?: FieldBinding[];
}

/** 可复用字段定义被引用时允许覆盖的实例级属性。 */
export type FormFieldReferenceOverrides = Partial<Pick<
  FormField,
  | 'key'
  | 'name'
  | 'required'
  | 'omitNull'
  | 'omitWhenHidden'
  | 'rules'
  | 'defaultValue'
  | 'hint'
  | 'componentProperties'
  | 'componentData'
  | 'componentDataKey'
  | 'eventSubscriptions'
  | 'binds'
>>;

/** 引用 FormSchema definitions 中可复用字段定义的节点。 */
export interface FormFieldReference extends FormFieldReferenceOverrides {
  /** definitions 中需要引用的字段定义名称。 */
  $ref: string;
}

/** 表单字段列表中允许出现的普通字段或字段定义引用。 */
export type FormFieldNode = FormField | FormFieldReference;

/** 数组元素允许使用的匿名字段配置或字段定义引用。 */
export type FormArrayElementNode = Omit<FormField, 'key' | 'name'>
  | FormFieldReference;

/** record 字段中固定为字符串类型的动态 key 编辑定义。 */
export type FormRecordKeyDefinition = Partial<Pick<
  FormField,
  | 'name'
  | 'hint'
  | 'rules'
  | 'defaultValue'
  | 'component'
  | 'componentProperties'
  | 'componentData'
  | 'componentDataKey'
>>;

/** record 字段中动态 key 和统一 value 的配置。 */
export interface FormRecordKeyValueDefinition {
  /** 动态属性名定义；数据类型固定为 string。 */
  key: FormRecordKeyDefinition;
  /** 每个动态属性值使用的匿名字段定义或 definitions 引用。 */
  value: FormArrayElementNode;
}

/** definitions 中不携带实例字段标识的可复用字段模板。 */
export type FormFieldDefinition = Omit<FormField, 'key' | 'name'>;

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
  /** 表单标题。 */
  name: string;
  /** 字段标签位置；未配置时默认使用 left。 */
  labelPosition?: LabelPosition;
  /** 可通过 $ref 按需引用的字段模板。 */
  definitions?: Record<string, FormFieldDefinition>;
  /** 顶层字段定义或引用列表。 */
  fields: FormFieldNode[];
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

/** 可渲染字段控件需要实现的约定。 */
export interface HandleTarget {
  /** 对控件执行 form-easy 操作命令，并携带当前事件流历史。 */
  applyHandle(handle: ComponentHandle, value?: unknown, history?: EventFlowHistory): void;
}
