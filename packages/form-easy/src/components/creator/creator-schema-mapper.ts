import type {
  FieldBinding,
  FieldValidationRule,
  FormField,
  FormSchema,
  LabelPosition
} from '../../types';
import type {
  FormSchemaValidationIssue,
  FormSchemaValidationResult
} from '../../validation/schema';

/** creator 动态表单内部维护的可编辑数据。 */
export type CreatorFormValue = Record<string, unknown>;

/** creator 数据转换为表单 schema 后的结果。 */
export interface CreatorSchemaMappingResult {
  /** 当前生成的表单 schema。 */
  schema: FormSchema;
  /** JSON 文本解析阶段发现的问题。 */
  issues: FormSchemaValidationIssue[];
}

/** creator 在未传入待编辑 schema 时使用的初始表单。 */
const defaultCreatedSchema: FormSchema = {
  key: 'newForm',
  name: '未命名表单',
  labelPosition: 'left',
  fields: [
    {
      key: 'title',
      name: '标题',
      category: 'basic',
      dataType: 'string',
      required: true,
      componentProperties: {
        placeholder: '请输入标题'
      }
    }
  ]
};

/** 将待编辑表单 schema 转换为 creator 动态表单需要的数据。 */
export function createCreatorFormValue(schema: FormSchema = defaultCreatedSchema): CreatorFormValue {
  return {
    formKey: schema.key,
    formName: schema.name,
    labelPosition: schema.labelPosition ?? 'left',
    fieldDefinitions: schema.fields.map(field => createFieldDraft(field))
  };
}

/** 将 creator 动态表单数据转换为标准 FormSchema。 */
export function mapCreatorValueToSchema(value: CreatorFormValue): CreatorSchemaMappingResult {
  const issues: FormSchemaValidationIssue[] = [];
  const fieldValues = Array.isArray(value.fieldDefinitions) ? value.fieldDefinitions : [];
  const labelPosition = readOptionalString(value.labelPosition) as LabelPosition | undefined;
  return {
    schema: {
      key: readString(value.formKey),
      name: readString(value.formName),
      ...(labelPosition ? { labelPosition } : {}),
      fields: fieldValues.map((field, index) => mapFieldDraft(
        field,
        `$.fieldDefinitions[${index}]`,
        issues
      ))
    },
    issues
  };
}

/** 将 JSON 文本解析问题合并到 schema 静态校验结果。 */
export function mergeCreatorValidationResults(
  schemaValidation: FormSchemaValidationResult,
  mappingIssues: FormSchemaValidationIssue[]
): FormSchemaValidationResult {
  const issues = [...mappingIssues, ...schemaValidation.issues];
  const errors = issues.filter(issue => issue.level === 'error');
  const warnings = issues.filter(issue => issue.level === 'warning');
  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings
  };
}

/** 将标准字段转换为 creator 内部字段草稿。 */
function createFieldDraft(field: FormField): CreatorFormValue {
  return {
    key: field.key ?? null,
    name: field.name ?? null,
    category: field.category,
    required: field.required ?? false,
    hint: field.hint ?? null,
    dataType: field.dataType ?? null,
    component: field.component ?? null,
    componentDataKey: field.componentDataKey ?? null,
    defaultValueJson: hasOwn(field, 'defaultValue') ? stringifyJson(field.defaultValue) : null,
    componentPropertiesJson: field.componentProperties
      ? stringifyJson(field.componentProperties)
      : null,
    componentDataJson: hasOwn(field, 'componentData')
      ? stringifyJson(field.componentData)
      : null,
    elementJson: field.element ? stringifyJson(field.element) : null,
    fieldsJson: field.fields ? stringifyJson(field.fields) : null,
    rules: (field.rules ?? []).map(rule => ({
      type: rule.type,
      valueJson: hasOwn(rule, 'value') ? stringifyJson(rule.value) : null,
      message: rule.message ?? null
    })),
    binds: (field.binds ?? []).map(binding => ({ ...binding })),
    eventSubscriptions: (field.eventSubscriptions ?? []).map(subscription => ({ ...subscription }))
  };
}

/** 将单个 creator 字段草稿转换为 FormField。 */
function mapFieldDraft(
  value: unknown,
  path: string,
  issues: FormSchemaValidationIssue[]
): FormField {
  const draft = isRecord(value) ? value : {};
  const category = readString(draft.category) as FormField['category'];
  const field: FormField = {
    key: readString(draft.key),
    name: readString(draft.name),
    category
  };
  if (draft.required === true) field.required = true;
  assignOptionalString(field, 'hint', draft.hint);
  assignOptionalJson(field, 'defaultValue', draft.defaultValueJson, `${path}.defaultValueJson`, issues);

  const rules = mapRules(draft.rules, `${path}.rules`, issues);
  if (rules.length > 0) field.rules = rules;
  const binds = mapRecordArray(draft.binds) as unknown as FieldBinding[];
  if (binds.length > 0) field.binds = binds;
  const eventSubscriptions = mapRecordArray(draft.eventSubscriptions);
  if (eventSubscriptions.length > 0) {
    field.eventSubscriptions = eventSubscriptions as unknown as FormField['eventSubscriptions'];
  }

  if (category === 'basic') {
    field.dataType = readString(draft.dataType) as FormField['dataType'];
    assignOptionalString(field, 'component', draft.component);
    assignOptionalString(field, 'componentDataKey', draft.componentDataKey);
    assignOptionalJson(
      field,
      'componentProperties',
      draft.componentPropertiesJson,
      `${path}.componentPropertiesJson`,
      issues
    );
    assignOptionalJson(
      field,
      'componentData',
      draft.componentDataJson,
      `${path}.componentDataJson`,
      issues
    );
  }
  if (category === 'array') {
    assignOptionalJson(field, 'element', draft.elementJson, `${path}.elementJson`, issues);
  }
  if (category === 'object') {
    assignOptionalJson(field, 'fields', draft.fieldsJson, `${path}.fieldsJson`, issues);
  }
  return field;
}

/** 将 creator 的规则草稿数组转换为同步校验规则。 */
function mapRules(
  value: unknown,
  path: string,
  issues: FormSchemaValidationIssue[]
): FieldValidationRule[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const ruleDraft = isRecord(item) ? item : {};
    const rule: FieldValidationRule = {
      type: readString(ruleDraft.type) as FieldValidationRule['type']
    };
    assignOptionalString(rule, 'message', ruleDraft.message);
    assignOptionalJson(rule, 'value', ruleDraft.valueJson, `${path}[${index}].valueJson`, issues);
    return rule;
  });
}

/** 将未知数组安全转换为浅复制的普通对象数组。 */
function mapRecordArray(value: unknown): CreatorFormValue[] {
  return Array.isArray(value)
    ? value.map(item => isRecord(item) ? { ...item } : {})
    : [];
}

/** 将非空字符串属性写入目标对象。 */
function assignOptionalString<T extends object>(
  target: T,
  property: keyof T,
  value: unknown
): void {
  const stringValue = readOptionalString(value);
  if (stringValue !== undefined) target[property] = stringValue as T[keyof T];
}

/** 解析并写入一个可选 JSON 文本属性。 */
function assignOptionalJson<T extends object>(
  target: T,
  property: keyof T,
  value: unknown,
  path: string,
  issues: FormSchemaValidationIssue[]
): void {
  if (typeof value !== 'string' || !value.trim()) return;
  try {
    target[property] = JSON.parse(value) as T[keyof T];
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    issues.push({
      level: 'error',
      code: 'invalid-value',
      path,
      message: `JSON 内容无法解析：${reason}`
    });
  }
}

/** 将未知值转换为字符串，其他类型返回空字符串。 */
function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** 读取可选非空字符串。 */
function readOptionalString(value: unknown): string | undefined {
  const stringValue = readString(value);
  return stringValue || undefined;
}

/** 将 JSON 值格式化为便于编辑的缩进文本。 */
function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? '';
}

/** 判断未知值是否为可读取的对象记录。 */
function isRecord(value: unknown): value is CreatorFormValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** 判断对象自身是否声明指定属性。 */
function hasOwn(value: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
}
