import type {
  FieldBinding,
  FieldValidationRule,
  FormField,
  FormFieldDefinition,
  FormFieldNode,
  FormFieldReference,
  FormRecordKeyDefinition,
  FormSchema,
  LabelPosition,
  NamedFormFieldNode,
  AnonymousFormFieldNode
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
    key: schema.key,
    name: schema.name,
    labelPosition: schema.labelPosition ?? 'left',
    definitions: Object.fromEntries(
      Object.entries(schema.definitions ?? {}).map(([name, definition]) => [
        name,
        createInlineFieldDraft(definition)
      ])
    ),
    fields: schema.fields.map(fieldNode =>
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
    $ref: null,
    ...createInlineFieldDraft(fieldNode)
  };
}

/** 将 creator 动态表单数据转换为标准 FormSchema。 */
export function mapCreatorValueToSchema(value: CreatorFormValue): CreatorSchemaMappingResult {
  const issues: FormSchemaValidationIssue[] = [];
  const fieldValues = Array.isArray(value.fields) ? value.fields : [];
  const labelPosition = readOptionalString(value.labelPosition) as LabelPosition | undefined;
  const definitions = mapDefinitionDrafts(value.definitions, issues);
  return {
    schema: {
      key: readString(value.key),
      name: readString(value.name),
      ...(labelPosition ? { labelPosition } : {}),
      ...(Object.keys(definitions).length > 0 ? { definitions } : {}),
      fields: fieldValues.map((field, index) => mapFieldNodeDraft(
        field,
        `$.fields[${index}]`,
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

/** 将 definitions record 草稿转换为以动态名称为键的字段定义对象。 */
function mapDefinitionDrafts(
  value: unknown,
  issues: FormSchemaValidationIssue[]
): Record<string, FormFieldDefinition> {
  if (!isRecord(value)) return {};
  const definitions: Array<[string, FormFieldDefinition]> = [];
  Object.entries(value).forEach(([rawName, definition]) => {
    const name = rawName.trim();
    const definitionPath = `$.definitions[${JSON.stringify(rawName)}]`;
    if (!name) {
      addMappingIssue(issues, definitionPath, '字段定义名称不能为空。');
      return;
    }
    if (name !== rawName) {
      addMappingIssue(
        issues,
        definitionPath,
        '字段定义名称的首尾不能包含空白。'
      );
      return;
    }
    definitions.push([
      name,
      mapInlineFieldDraft(definition, definitionPath, issues)
    ]);
  });
  return Object.fromEntries(definitions);
}

/** 将普通字段转换为不包含实例标识的内联定义草稿。 */
function createInlineFieldDraft(field: FormField): CreatorFormValue {
  const element = field.element
    ? createFieldNodeDraft(field.element, false)
    : undefined;
  const fields = (field.fields ?? []).map(childFieldNode =>
    createFieldNodeDraft(childFieldNode, true)
  );
  return {
    category: field.category,
    ...(hasOwn(field, 'required') ? { required: field.required } : {}),
    ...(hasOwn(field, 'optional') ? { optional: field.optional } : {}),
    ...(hasOwn(field, 'omitNull') ? { omitNull: field.omitNull } : {}),
    ...(hasOwn(field, 'omitWhenHidden')
      ? { omitWhenHidden: field.omitWhenHidden }
      : {}),
    ...(hasOwn(field, 'hint') ? { hint: field.hint } : {}),
    ...(hasOwn(field, 'dataType') ? { dataType: field.dataType } : {}),
    ...(hasOwn(field, 'component') ? { component: field.component } : {}),
    ...(hasOwn(field, 'componentDataKey')
      ? { componentDataKey: field.componentDataKey }
      : {}),
    ...(hasOwn(field, 'defaultValue')
      ? { defaultValue: cloneJsonValue(field.defaultValue) }
      : {}),
    ...(hasOwn(field, 'componentProperties')
      ? { componentProperties: cloneJsonValue(field.componentProperties) }
      : {}),
    ...(hasOwn(field, 'componentData')
      ? { componentData: cloneJsonValue(field.componentData) }
      : {}),
    ...(hasOwn(field, 'kvDef') && field.kvDef
      ? {
        kvDef: {
          key: createRecordKeyDraft(field.kvDef.key),
          value: createFieldNodeDraft(field.kvDef.value, false)
        }
      }
      : {}),
    ...(element ? { element } : {}),
    ...(hasOwn(field, 'fields') ? { fields } : {}),
    ...(hasOwn(field, 'rules') ? { rules: createRulesDraft(field.rules) } : {}),
    ...(hasOwn(field, 'binds')
      ? { binds: (field.binds ?? []).map(binding => ({ ...binding })) }
      : {}),
    ...(hasOwn(field, 'eventSubscriptions')
      ? {
        eventSubscriptions: (field.eventSubscriptions ?? []).map(
          subscription => ({ ...subscription })
        )
      }
      : {})
  };
}

/** 将引用节点转换为设计器草稿，不展开它所指向的字段定义。 */
function createReferenceFieldDraft(
  reference: FormFieldReference,
  requiresIdentity: boolean
): CreatorFormValue {
  return {
    ...(requiresIdentity ? createIdentityDraft(reference) : {}),
    $ref: reference.$ref,
    ...(hasOwn(reference, 'required') ? { required: reference.required } : {}),
    ...(hasOwn(reference, 'optional')
      ? { optional: reference.optional }
      : {}),
    ...(hasOwn(reference, 'omitNull')
      ? { omitNull: reference.omitNull }
      : {}),
    ...(hasOwn(reference, 'omitWhenHidden')
      ? { omitWhenHidden: reference.omitWhenHidden }
      : {}),
    ...(hasOwn(reference, 'hint')
      ? { hint: reference.hint }
      : {}),
    ...(hasOwn(reference, 'componentDataKey')
      ? { componentDataKey: reference.componentDataKey }
      : {}),
    ...(hasOwn(reference, 'defaultValue')
      ? { defaultValue: cloneJsonValue(reference.defaultValue) }
      : {}),
    ...(hasOwn(reference, 'componentProperties')
      ? {
        componentProperties: cloneJsonValue(
          reference.componentProperties
        )
      }
      : {}),
    ...(hasOwn(reference, 'componentData')
      ? { componentData: cloneJsonValue(reference.componentData) }
      : {}),
    ...(hasOwn(reference, 'rules')
      ? { rules: createRulesDraft(reference.rules) }
      : {}),
    ...(hasOwn(reference, 'binds')
      ? {
        binds: (reference.binds ?? []).map(binding => ({
          ...binding
        }))
      }
      : {}),
    ...(hasOwn(reference, 'eventSubscriptions')
      ? {
        eventSubscriptions: (
          reference.eventSubscriptions ?? []
        ).map(subscription => ({ ...subscription }))
      }
      : {})
  };
}

/** 读取字段实例的 key 和 name，供普通字段位置的节点草稿使用。 */
function createIdentityDraft(field: FormFieldReference | FormField): CreatorFormValue {
  return {
    key: field.key ?? null,
    name: field.name ?? null
  };
}

/** 将校验规则转换为设计器直接编辑真实值的草稿。 */
function createRulesDraft(rules?: FieldValidationRule[]): CreatorFormValue[] {
  return (rules ?? []).map(rule => ({
    type: rule.type,
    value: hasOwn(rule, 'value') ? cloneJsonValue(rule.value) : null,
    message: rule.message ?? null
  }));
}

/** 将字段节点草稿转换为普通字段或 definitions 引用。 */
function mapFieldNodeDraft(
  value: unknown,
  path: string,
  issues: FormSchemaValidationIssue[],
  requiresIdentity: true
): NamedFormFieldNode;
/** 将匿名位置的字段草稿转换为严格的匿名字段节点。 */
function mapFieldNodeDraft(
  value: unknown,
  path: string,
  issues: FormSchemaValidationIssue[],
  requiresIdentity: false
): AnonymousFormFieldNode;
/** 根据字段所在位置将草稿转换为对应的字段节点。 */
function mapFieldNodeDraft(
  value: unknown,
  path: string,
  issues: FormSchemaValidationIssue[],
  requiresIdentity: boolean
): FormFieldNode {
  const draft = isRecord(value) ? value : {};
  const referenceName = readOptionalString(draft.$ref);
  if (referenceName) {
    return mapReferenceFieldDraft(draft, requiresIdentity);
  }
  const field = mapInlineFieldDraft(draft, path, issues);
  if (requiresIdentity) {
    return {
      ...field,
      key: readString(draft.key),
      name: readString(draft.name)
    } as NamedFormFieldNode;
  }
  return field as AnonymousFormFieldNode;
}

/** 将内联字段定义草稿转换为不包含实例标识的字段配置。 */
function mapInlineFieldDraft(
  value: unknown,
  path: string,
  issues: FormSchemaValidationIssue[]
): FormFieldDefinition {
  const draft = isRecord(value) ? value : {};
  const category = readString(draft.category) as FormField['category'];
  const field = { category } as FormField;
  assignSharedFieldDraftProperties(field, draft);

  if (category === 'basic') {
    field.dataType = readString(draft.dataType) as FormField['dataType'];
    assignStringProperty(field, 'component', draft.component);
  }
  if (category === 'array') {
    if (isRecord(draft.element)) {
      field.element = mapFieldNodeDraft(
        draft.element,
        `${path}.element`,
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
  if (category === 'record' && isRecord(draft.kvDef)) {
    field.kvDef = {
      key: mapRecordKeyDraft(draft.kvDef.key),
      value: mapFieldNodeDraft(
        draft.kvDef.value,
        `${path}.kvDef.value`,
        issues,
        false
      )
    };
  }
  return field as FormFieldDefinition;
}

/** 将 record 动态字符串 key 定义转换为设计器草稿。 */
function createRecordKeyDraft(
  keyDefinition: FormRecordKeyDefinition
): CreatorFormValue {
  return {
    name: keyDefinition.name ?? null,
    hint: keyDefinition.hint ?? null,
    component: keyDefinition.component ?? null,
    componentDataKey: keyDefinition.componentDataKey ?? null,
    defaultValue: hasOwn(keyDefinition, 'defaultValue')
      ? cloneJsonValue(keyDefinition.defaultValue)
      : null,
    componentProperties: keyDefinition.componentProperties
      ? cloneJsonValue(keyDefinition.componentProperties)
      : null,
    componentData: hasOwn(keyDefinition, 'componentData')
      ? cloneJsonValue(keyDefinition.componentData)
      : null,
    rules: createRulesDraft(keyDefinition.rules)
  };
}

/** 将设计器草稿转换为固定 string 类型的 record key 定义。 */
function mapRecordKeyDraft(
  value: unknown
): FormRecordKeyDefinition {
  const draft = isRecord(value) ? value : {};
  const keyDefinition: FormRecordKeyDefinition = {};
  assignOptionalString(keyDefinition, 'name', draft.name);
  assignOptionalString(keyDefinition, 'hint', draft.hint);
  assignOptionalString(keyDefinition, 'component', draft.component);
  assignOptionalString(
    keyDefinition,
    'componentDataKey',
    draft.componentDataKey
  );
  assignOptionalValue(keyDefinition, 'defaultValue', draft);
  assignOptionalValue(keyDefinition, 'componentProperties', draft);
  assignOptionalValue(keyDefinition, 'componentData', draft);
  const rules = mapRules(draft.rules);
  if (rules.length > 0) keyDefinition.rules = rules;
  return keyDefinition;
}

/** 将引用草稿转换为 $ref 节点及其可选实例覆盖。 */
function mapReferenceFieldDraft(
  draft: CreatorFormValue,
  requiresIdentity: boolean
): FormFieldReference {
  const reference: FormFieldReference = {
    $ref: readString(draft.$ref)
  };
  if (requiresIdentity) {
    reference.key = readString(draft.key);
    reference.name = readString(draft.name);
  }
  assignSharedFieldDraftProperties(reference, draft);
  return reference;
}

/** 将内联与引用节点共用的可选属性从设计器草稿写入目标字段。 */
function assignSharedFieldDraftProperties(
  target: FormField | FormFieldReference,
  draft: CreatorFormValue
): void {
  assignBooleanProperty(target, 'required', draft.required);
  assignBooleanProperty(target, 'optional', draft.optional);
  assignBooleanProperty(target, 'omitNull', draft.omitNull);
  assignBooleanProperty(target, 'omitWhenHidden', draft.omitWhenHidden);
  assignStringProperty(target, 'hint', draft.hint);
  assignStringProperty(target, 'componentDataKey', draft.componentDataKey);
  assignOptionalValue(target, 'defaultValue', draft);
  assignOptionalValue(target, 'componentProperties', draft);
  assignOptionalValue(target, 'componentData', draft);
  if (Array.isArray(draft.rules)) {
    target.rules = mapRules(draft.rules);
  }
  if (Array.isArray(draft.binds)) {
    target.binds = mapRecordArray(draft.binds) as unknown as FieldBinding[];
  }
  if (Array.isArray(draft.eventSubscriptions)) {
    target.eventSubscriptions = mapRecordArray(
      draft.eventSubscriptions
    ) as unknown as FormField['eventSubscriptions'];
  }
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
  value: unknown
): FieldValidationRule[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    const ruleDraft = isRecord(item) ? item : {};
    const rule: FieldValidationRule = {
      type: readString(ruleDraft.type) as FieldValidationRule['type'],
      value: cloneJsonValue(ruleDraft.value)
    };
    assignOptionalString(rule, 'message', ruleDraft.message);
    return rule;
  });
}

/** 将未知数组安全转换为浅复制的普通对象数组。 */
function mapRecordArray(value: unknown): CreatorFormValue[] {
  return Array.isArray(value)
    ? value.map(item => isRecord(item) ? { ...item } : {})
    : [];
}

/** 原样写入草稿中明确存在的布尔属性，包括 false。 */
function assignBooleanProperty<T extends object>(
  target: T,
  property: keyof T,
  value: unknown
): void {
  if (typeof value === 'boolean') {
    target[property] = value as T[keyof T];
  }
}

/** 原样写入草稿中明确存在的字符串属性，包括空字符串。 */
function assignStringProperty<T extends object>(
  target: T,
  property: keyof T,
  value: unknown
): void {
  if (typeof value === 'string') {
    target[property] = value as T[keyof T];
  }
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

/** 将草稿中明确存在的真实值深复制到目标对象。 */
function assignOptionalValue<T extends object>(
  target: T,
  property: keyof T,
  source: CreatorFormValue
): void {
  const propertyName = String(property);
  if (!hasOwn(source, propertyName)) return;
  target[property] = cloneJsonValue(source[propertyName]) as T[keyof T];
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

/** 深复制设计器维护的 JSON 值，避免草稿与输出共享可变引用。 */
function cloneJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => cloneJsonValue(item));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneJsonValue(item)])
    );
  }
  return value;
}

/** 判断未知值是否为可读取的对象记录。 */
function isRecord(value: unknown): value is CreatorFormValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** 判断对象自身是否声明指定属性。 */
function hasOwn(value: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
}
