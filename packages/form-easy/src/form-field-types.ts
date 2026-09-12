/** 表单结构支持的字段分类。 */
export type FieldCategory = 'basic' | 'array' | 'object' | 'record';

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

/** 描述一个可序列化的同步字段校验规则。 */
export interface FieldValidationRule {
  /** 当前校验规则的类型。 */
  type: FieldValidationRuleType;
  /** 当前规则使用的比较值。 */
  value: unknown;
  /** 校验失败时展示的自定义错误信息。 */
  message?: string;
}

/** 所有 form-easy 字段组件支持的操作命令。 */
export type ComponentHandle = 'show' | 'hide' | 'disable' | 'enable' | 'clear' | 'change';

/** 字段操作实际生效后触发的事件。 */
export type ComponentEventName =
  | 'onShow'
  | 'onHide'
  | 'onDisabled'
  | 'onEnabled'
  | 'onClear'
  | 'onChange';

/** 当前事件流中已经触发过的事件唯一标识列表。 */
export type EventFlowHistory = readonly string[];

/** 当前字段支持绑定的目标属性。 */
export type BindingTarget = 'visible' | 'enable' | 'value';

/** 字段绑定中参数名到源字段引用的映射。 */
export type FieldBindingParams = Record<string, string>;

/** 声明一组源字段如何共同计算当前字段的目标属性。 */
export interface FieldBinding {
  /** 当前字段需要同步的目标属性。 */
  target: BindingTarget;
  /** resolver 参数名到相对或完整源字段标识的映射。 */
  params: FieldBindingParams;
  /**
   * 根据全部命名源字段参数计算目标值的 JavaScript 函数体。
   * visible 和 enable 会将返回值转换为布尔值，value 直接使用返回值。
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

/** 所有字段分类共享的实例配置。 */
export interface FormFieldCommonConfiguration {
  /** 当前字段是否必填。 */
  required?: boolean;
  /** 当前字段按顺序执行的同步校验规则。 */
  rules?: FieldValidationRule[];
  /** 未提供运行时数据时使用的默认值。 */
  defaultValue?: unknown;
  /** 展示在字段名称旁的提示文本。 */
  hint?: string;
  /** 当前字段拥有的事件订阅配置。 */
  eventSubscriptions?: EventSubscription[];
  /** 当前字段拥有的单向绑定配置。 */
  binds?: FieldBinding[];
}

/** 基础字段专属的组件渲染配置。 */
export interface BasicFieldComponentConfiguration {
  /** 优先于数据类型默认组件使用的已注册组件键。 */
  component?: BasicFieldComponentKey;
  /** 透传给已注册自定义组件的属性。 */
  componentProperties?: Record<string, unknown>;
  /** 直接提供给组件的数据，优先于 componentDataKey。 */
  componentData?: unknown;
  /** 用于通过组件数据解析器加载数据的业务键或带字段参数的调用表达式。 */
  componentDataKey?: ComponentDataKey;
}

/** 基础字段定义。 */
export interface BasicFieldDefinition
  extends FormFieldCommonConfiguration,
  BasicFieldComponentConfiguration {
  /** 当前字段的渲染分类。 */
  category: 'basic';
  /** 当前基础字段值的数据类型。 */
  dataType: DataType;
  /** 基础字段不允许配置数组元素。 */
  element?: never;
  /** 基础字段不允许配置对象子字段。 */
  fields?: never;
  /** 基础字段不允许配置 record 键值定义。 */
  kvDef?: never;
}

/** 数组字段定义。 */
export interface ArrayFieldDefinition extends FormFieldCommonConfiguration {
  /** 当前字段的渲染分类。 */
  category: 'array';
  /** 数组中每个元素使用的匿名字段节点。 */
  element: AnonymousFormFieldNode;
  /** 数组字段不允许配置基础数据类型。 */
  dataType?: never;
  /** 数组字段不允许配置基础组件。 */
  component?: never;
  /** 数组字段不允许配置基础组件属性。 */
  componentProperties?: never;
  /** 数组字段不允许配置基础组件静态数据。 */
  componentData?: never;
  /** 数组字段不允许配置基础组件数据键。 */
  componentDataKey?: never;
  /** 数组字段不允许配置对象子字段。 */
  fields?: never;
  /** 数组字段不允许配置 record 键值定义。 */
  kvDef?: never;
}

/** 对象字段定义。 */
export interface ObjectFieldDefinition extends FormFieldCommonConfiguration {
  /** 当前字段的渲染分类。 */
  category: 'object';
  /** 对象中包含的命名字段节点。 */
  fields: NamedFormFieldNode[];
  /** 对象字段不允许配置基础数据类型。 */
  dataType?: never;
  /** 对象字段不允许配置基础组件。 */
  component?: never;
  /** 对象字段不允许配置基础组件属性。 */
  componentProperties?: never;
  /** 对象字段不允许配置基础组件静态数据。 */
  componentData?: never;
  /** 对象字段不允许配置基础组件数据键。 */
  componentDataKey?: never;
  /** 对象字段不允许配置数组元素。 */
  element?: never;
  /** 对象字段不允许配置 record 键值定义。 */
  kvDef?: never;
}

/** record 字段定义。 */
export interface RecordFieldDefinition extends FormFieldCommonConfiguration {
  /** 当前字段的渲染分类。 */
  category: 'record';
  /** record 动态键和值的统一定义。 */
  kvDef: FormRecordKeyValueDefinition;
  /** record 字段不允许配置基础数据类型。 */
  dataType?: never;
  /** record 字段不允许配置基础组件。 */
  component?: never;
  /** record 字段不允许配置基础组件属性。 */
  componentProperties?: never;
  /** record 字段不允许配置基础组件静态数据。 */
  componentData?: never;
  /** record 字段不允许配置基础组件数据键。 */
  componentDataKey?: never;
  /** record 字段不允许配置数组元素。 */
  element?: never;
  /** record 字段不允许配置对象子字段。 */
  fields?: never;
}

/** 不包含字段位置约束的分类字段定义。 */
export type FormFieldDefinition =
  | BasicFieldDefinition
  | ArrayFieldDefinition
  | ObjectFieldDefinition
  | RecordFieldDefinition;

/** 命名字段必须携带的身份和输出控制配置。 */
export interface NamedFormFieldIdentity {
  /** 用于读写字段值的键。 */
  key: string;
  /** 面向用户展示的字段名称。 */
  name: string;
  /** 是否允许用户控制当前字段是否存在于最终输出对象中。 */
  optional?: boolean;
  /** 值为 null 或 undefined 时是否从父级输出对象中省略当前字段。 */
  omitNull?: boolean;
  /** 字段隐藏时是否从父级输出对象中省略当前字段。 */
  omitWhenHidden?: boolean;
}

/** 匿名字段禁止携带的身份和输出控制配置。 */
export interface AnonymousFormFieldIdentity {
  /** 匿名字段不允许配置字段键。 */
  key?: never;
  /** 匿名字段不允许配置字段名称。 */
  name?: never;
  /** 匿名字段不允许配置可选输出。 */
  optional?: never;
  /** 匿名字段不允许配置空值省略。 */
  omitNull?: never;
  /** 匿名字段不允许配置隐藏省略。 */
  omitWhenHidden?: never;
}

/** 表单顶层或对象内部使用的命名字段。 */
export type NamedFormField = FormFieldDefinition & NamedFormFieldIdentity;

/** definitions、数组元素或 record value 使用的匿名字段。 */
export type AnonymousFormField = FormFieldDefinition & AnonymousFormFieldIdentity;

/** 字段引用允许覆盖的通用实例配置。 */
export interface FormFieldReferenceCommonOverrides {
  /** 覆盖模板的必填状态。 */
  required?: boolean;
  /** 覆盖模板的同步校验规则。 */
  rules?: FieldValidationRule[];
  /** 覆盖模板的默认值。 */
  defaultValue?: unknown;
  /** 覆盖模板的提示文本。 */
  hint?: string;
  /** 覆盖模板的组件属性。 */
  componentProperties?: Record<string, unknown>;
  /** 覆盖模板的组件静态数据。 */
  componentData?: unknown;
  /** 覆盖模板的组件数据键。 */
  componentDataKey?: ComponentDataKey;
  /** 覆盖模板的事件订阅配置。 */
  eventSubscriptions?: EventSubscription[];
  /** 覆盖模板的单向绑定配置。 */
  binds?: FieldBinding[];
}

/** 命名位置使用的字段定义引用。 */
export interface NamedFormFieldReference
  extends FormFieldReferenceCommonOverrides,
  NamedFormFieldIdentity {
  /** definitions 中需要引用的字段定义名称。 */
  $ref: string;
}

/** 匿名位置使用的字段定义引用。 */
export interface AnonymousFormFieldReference
  extends FormFieldReferenceCommonOverrides,
  AnonymousFormFieldIdentity {
  /** definitions 中需要引用的字段定义名称。 */
  $ref: string;
}

/** 命名字段列表中允许出现的内联字段或字段定义引用。 */
export type NamedFormFieldNode = NamedFormField | NamedFormFieldReference;

/** 匿名字段位置允许出现的内联字段或字段定义引用。 */
export type AnonymousFormFieldNode = AnonymousFormField | AnonymousFormFieldReference;

/** record 字段中固定为字符串类型的动态 key 编辑定义。 */
export interface FormRecordKeyDefinition extends BasicFieldComponentConfiguration {
  /** 动态键编辑器的名称。 */
  name?: string;
  /** 动态键编辑器的提示文本。 */
  hint?: string;
  /** 动态键执行的同步校验规则。 */
  rules?: FieldValidationRule[];
  /** 新增条目时使用的默认键。 */
  defaultValue?: unknown;
}

/** record 字段中动态 key 和统一 value 的配置。 */
export interface FormRecordKeyValueDefinition {
  /** 动态属性名定义；数据类型固定为 string。 */
  key: FormRecordKeyDefinition;
  /** 每个动态属性值使用的匿名字段节点。 */
  value: AnonymousFormFieldNode;
}

/** 解析或渲染阶段使用的字段类型，字段身份由实际所在位置决定。 */
export type ResolvedFormField = FormFieldDefinition & Partial<NamedFormFieldIdentity>;

/**
 * 兼容原有 API 的字段类型。
 *
 * schema 声明应优先使用 NamedFormField 或 AnonymousFormField；解析器与渲染器
 * 可继续使用此类型处理已经脱离原始声明位置的字段。
 */
export type FormField = ResolvedFormField;

/** 兼容原有 API 的宽松字段引用类型。 */
export interface FormFieldReference extends FormFieldReferenceCommonOverrides {
  /** definitions 中需要引用的字段定义名称。 */
  $ref: string;
  /** 命名位置覆盖后的字段键。 */
  key?: string;
  /** 命名位置覆盖后的字段名称。 */
  name?: string;
  /** 是否允许用户控制命名字段是否存在于最终输出对象中。 */
  optional?: boolean;
  /** 值为空时是否省略命名字段。 */
  omitNull?: boolean;
  /** 字段隐藏时是否省略命名字段。 */
  omitWhenHidden?: boolean;
}

/** 兼容原有 API 的任意位置字段节点类型。 */
export type FormFieldNode = FormField | FormFieldReference;

/** 兼容原有 API 的数组元素节点类型。 */
export type FormArrayElementNode = AnonymousFormFieldNode;

/** 兼容原有 API 的字段引用覆盖配置。 */
export type FormFieldReferenceOverrides = Omit<FormFieldReference, '$ref'>;

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
