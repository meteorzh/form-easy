/** 表单结构支持的字段分类。 */
export type FieldCategory = 'basic' | 'array' | 'object';

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
  /** 绑定源字段的完整唯一标识。 */
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
  /** 未提供运行时数据时使用的默认值。 */
  defaultValue?: unknown;
  /** 展示在字段名称旁的提示文本。 */
  hint?: string;
  /** 值的数据类型，仅适用于基础字段。 */
  dataType?: DataType;
  /** 优先于数据类型默认组件使用的已注册组件键。 */
  component?: BasicFieldComponentKey;
  /** 数组字段的元素定义。 */
  element?: Omit<FormField, 'key' | 'name'>;
  /** 对象字段包含的子字段。 */
  fields?: FormField[];
  /** 透传给已注册自定义组件的属性。 */
  componentProperties?: Record<string, unknown>;
  /** 直接提供给组件的数据，优先于 componentDataKey。 */
  componentData?: unknown;
  /** 用于通过组件数据解析器加载数据的业务键。 */
  componentDataKey?: ComponentDataKey;
  /** 当前字段拥有的事件订阅配置。 */
  eventSubscriptions?: EventSubscription[];
  /** 当前字段拥有的单向绑定配置。 */
  binds?: FieldBinding[];
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

/** 根据字段配置加载组件数据的函数。 */
export type ComponentDataResolver = (
  context: ComponentDataResolverContext
) => unknown | Promise<unknown>;

/** 描述完整的动态表单。 */
export interface FormSchema {
  /** 全局有意义的表单键。 */
  key: string;
  /** 表单标题。 */
  name: string;
  /** 字段标签位置；未配置时默认使用 left。 */
  labelPosition?: LabelPosition;
  /** 顶层字段定义列表。 */
  fields: FormField[];
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

/** 可渲染字段控件需要实现的约定。 */
export interface HandleTarget {
  /** 对控件执行 form-easy 操作命令，并携带当前事件流历史。 */
  applyHandle(handle: ComponentHandle, value?: unknown, history?: EventFlowHistory): void;
}
