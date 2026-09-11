import type {
  FieldBinding,
  FieldValidationRule,
  FormField,
  FormFieldDefinition,
  FormFieldNode,
  FormFieldReference,
  FormSchema,
  LabelPosition
} from '../../types';
import { isFormFieldReference } from '../../form-field-definition-resolver';
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

/** 设计器字段节点支持的声明方式。 */
type CreatorFieldMode = 'inline' | 'reference';

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
    schemaDefinitions: Object.entries(schema.definitions ?? {}).map(
      ([name, definition]) => ({
        name,
        definition: createInlineFieldDraft(definition)
      })
    ),
    fieldDefinitions: schema.fields.map(fieldNode =>
      createFieldNodeDraft(fieldNode, true)
    )
  };
}

/** 将一个普通字段或引用节点转换为设计器草稿，并保留引用边界。 */
function createFieldNodeDraft(
  fieldNode: FormFieldNode,
  requiresIdentity: boolean
): CreatorFormValue {
  if (isFormFieldReference(fieldNode)) {
    return createReferenceFieldDraft(fieldNode, requiresIdentity);
  }
  return {
    ...(requiresIdentity ? createIdentityDraft(fieldNode) : {}),
    mode: 'inline' satisfies CreatorFieldMode,
    definition: createInlineFieldDraft(fieldNode)
  };
}

/** 将 creator 动态表单数据转换为标准 FormSchema。 */
export function mapCreatorValueToSchema(value: CreatorFormValue): CreatorSchemaMappingResult {
  const issues: FormSchemaValidationIssue[] = [];
  const fieldValues = Array.isArray(value.fieldDefinitions) ? value.fieldDefinitions : [];
  const labelPosition = readOptionalString(value.labelPosition) as LabelPosition | undefined;
  const definitions = mapDefinitionDrafts(value.schemaDefinitions, issues);
  return {
    schema: {
      key: readString(value.formKey),
      name: readString(value.formName),
      ...(labelPosition ? { labelPosition } : {}),
      ...(Object.keys(definitions).length > 0 ? { definitions } : {}),
      fields: fieldValues.map((field, index) => mapFieldNodeDraft(
        field,
        `$.fieldDefinitions[${index}]`,
        issues,
        true
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

/** 将 definitions 数组草稿转换为以名称为键的字段定义对象。 */
function mapDefinitionDrafts(
  value: unknown,
  issues: FormSchemaValidationIssue[]
): Record<string, FormFieldDefinition> {
  const definitions: Record<string, FormFieldDefinition> = {};
  const nameIndexes = new Map<string, number>();
  if (!Array.isArray(value)) return definitions;

  value.forEach((item, index) => {
    const draft = isRecord(item) ? item : {};
    const name = readString(draft.name);
    const namePath = `$.schemaDefinitions[${index}].name`;
    if (!name) {
      addMappingIssue(issues, namePath, '字段定义名称不能为空。');
      return;
    }
    const previousIndex = nameIndexes.get(name);
    if (previousIndex !== undefined) {
      addMappingIssue(
        issues,
        namePath,
        `字段定义名称“${name}”与 $.schemaDefinitions[${previousIndex}] 重复。`
      );
      return;
    }
    nameIndexes.set(name, index);
    definitions[name] = mapInlineFieldDraft(
      draft.definition,
      `$.schemaDefinitions[${index}].definition`,
      issues
    );
  });
  return definitions;
}

/** 将普通字段转换为不包含实例标识的内联定义草稿。 */
function createInlineFieldDraft(field: FormField): CreatorFormValue {
  const elementDefinition = field.element
    ? createFieldNodeDraft(field.element, false)
    : undefined;
  const fields = (field.fields ?? []).map(childFieldNode =>
    createFieldNodeDraft(childFieldNode, true)
  );
  return {
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
    elementDefinition: elementDefinition ?? null,
    fields,
    rules: createRulesDraft(field.rules),
    binds: (field.binds ?? []).map(binding => ({ ...binding })),
    eventSubscriptions: (field.eventSubscriptions ?? []).map(
      subscription => ({ ...subscription })
    )
  };
}

/** 将引用节点转换为设计器草稿，不展开它所指向的字段定义。 */
function createReferenceFieldDraft(
  reference: FormFieldReference,
  requiresIdentity: boolean
): CreatorFormValue {
  return {
    ...(requiresIdentity ? createIdentityDraft(reference) : {}),
    mode: 'reference' satisfies CreatorFieldMode,
    referenceName: reference.$ref,
    requiredOverride: hasOwn(reference, 'required')
      ? String(reference.required)
      : 'inherit',
    hint: reference.hint ?? null,
    componentDataKey: reference.componentDataKey ?? null,
    defaultValueJson: hasOwn(reference, 'defaultValue')
      ? stringifyJson(reference.defaultValue)
      : null,
    componentPropertiesJson: reference.componentProperties
      ? stringifyJson(reference.componentProperties)
      : null,
    componentDataJson: hasOwn(reference, 'componentData')
      ? stringifyJson(reference.componentData)
      : null,
    rules: createRulesDraft(reference.rules),
    binds: (reference.binds ?? []).map(binding => ({ ...binding })),
    eventSubscriptions: (reference.eventSubscriptions ?? []).map(
      subscription => ({ ...subscription })
    )
  };
}

/** 读取字段实例的 key 和 name，供普通字段位置的节点草稿使用。 */
function createIdentityDraft(field: FormFieldReference | FormField): CreatorFormValue {
  return {
    key: field.key ?? null,
    name: field.name ?? null
  };
}

/** 将校验规则转换为设计器使用的 JSON 文本草稿。 */
function createRulesDraft(rules?: FieldValidationRule[]): CreatorFormValue[] {
  return (rules ?? []).map(rule => ({
    type: rule.type,
    valueJson: hasOwn(rule, 'value') ? stringifyJson(rule.value) : null,
    message: rule.message ?? null
  }));
}

/** 将字段节点草稿转换为普通字段或 definitions 引用。 */
function mapFieldNodeDraft(
  value: unknown,
  path: string,
  issues: FormSchemaValidationIssue[],
  requiresIdentity: boolean
): FormFieldNode {
  const draft = isRecord(value) ? value : {};
  const mode = readString(draft.mode) as CreatorFieldMode;
  if (mode === 'reference') {
    return mapReferenceFieldDraft(draft, path, issues, requiresIdentity);
  }
  const field = mapInlineFieldDraft(
    draft.definition,
    `${path}.definition`,
    issues
  );
  if (requiresIdentity) {
    return {
      ...field,
      key: readString(draft.key),
      name: readString(draft.name)
    };
  }
  return field;
}

/** 将内联字段定义草稿转换为不包含实例标识的字段配置。 */
function mapInlineFieldDraft(
  value: unknown,
  path: string,
  issues: FormSchemaValidationIssue[]
): FormFieldDefinition {
  const draft = isRecord(value) ? value : {};
  const category = readString(draft.category) as FormField['category'];
  const field: FormFieldDefinition = { category };
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
    if (isRecord(draft.elementDefinition)) {
      field.element = mapFieldNodeDraft(
        draft.elementDefinition,
        `${path}.elementDefinition`,
        issues,
        false
      );
    }
  }
  if (category === 'object') {
    const childFields = Array.isArray(draft.fields) ? draft.fields : [];
    field.fields = childFields.map((childField, index) => mapFieldNodeDraft(
      childField,
      `${path}.fields[${index}]`,
      issues,
      true
    ));
  }
  return field;
}

/** 将引用草稿转换为 $ref 节点及其可选实例覆盖。 */
function mapReferenceFieldDraft(
  draft: CreatorFormValue,
  path: string,
  issues: FormSchemaValidationIssue[],
  requiresIdentity: boolean
): FormFieldReference {
  const reference: FormFieldReference = {
    $ref: readString(draft.referenceName)
  };
  if (requiresIdentity) {
    reference.key = readString(draft.key);
    reference.name = readString(draft.name);
  }
  if (draft.requiredOverride === 'true') reference.required = true;
  if (draft.requiredOverride === 'false') reference.required = false;
  assignOptionalString(reference, 'hint', draft.hint);
  assignOptionalString(reference, 'componentDataKey', draft.componentDataKey);
  assignOptionalJson(
    reference,
    'defaultValue',
    draft.defaultValueJson,
    `${path}.defaultValueJson`,
    issues
  );
  assignOptionalJson(
    reference,
    'componentProperties',
    draft.componentPropertiesJson,
    `${path}.componentPropertiesJson`,
    issues
  );
  assignOptionalJson(
    reference,
    'componentData',
    draft.componentDataJson,
    `${path}.componentDataJson`,
    issues
  );
  const rules = mapRules(draft.rules, `${path}.rules`, issues);
  if (rules.length > 0) reference.rules = rules;
  const binds = mapRecordArray(draft.binds) as unknown as FieldBinding[];
  if (binds.length > 0) reference.binds = binds;
  const subscriptions = mapRecordArray(draft.eventSubscriptions);
  if (subscriptions.length > 0) {
    reference.eventSubscriptions = subscriptions as unknown as FormField['eventSubscriptions'];
  }
  return reference;
}

/** 向设计器映射结果追加一个可定位的输入错误。 */
function addMappingIssue(
  issues: FormSchemaValidationIssue[],
  path: string,
  message: string
): void {
  issues.push({
    level: 'error',
    code: 'invalid-value',
    path,
    message
  });
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
      type: readString(ruleDraft.type) as FieldValidationRule['type'],
      value: undefined
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
