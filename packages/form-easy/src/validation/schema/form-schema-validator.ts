import type {
  DataType,
  FieldCategory,
  FormField,
  LabelPosition
} from '../../types';
import { parseComponentDataExpression } from '../../component-data-expression';
import {
  isRelativeFieldReference,
  parseRelativeFieldReference
} from '../../field-reference';
import { SchemaValidationContext } from './schema-validation-context';
import { validateDefaultValue } from './schema-default-value-validator';
import { validateLocalFieldReferences } from './schema-reference-validator';
import {
  validateBindings,
  validateEventSubscriptions,
  validateFieldConfigurationConflicts
} from './schema-relation-validator';
import { validateSchemaRules } from './schema-rule-validator';
import type { FormSchemaValidationResult } from './schema-validation-types';
import {
  enterSchemaNode,
  hasOwn,
  indexPath,
  isPlainRecord,
  propertyPath,
  validateForbiddenProperties,
  validateOptionalType,
  validateRequiredIdentifier,
  validateRequiredNonEmptyString,
  validateUnknownProperties
} from './schema-validation-utils';

/** schema 根对象允许配置的属性。 */
const formSchemaProperties = new Set(['key', 'name', 'labelPosition', 'fields']);
/** 字段对象允许配置的全部属性。 */
const formFieldProperties = new Set([
  'key',
  'name',
  'category',
  'required',
  'rules',
  'defaultValue',
  'hint',
  'dataType',
  'component',
  'element',
  'fields',
  'componentProperties',
  'componentData',
  'componentDataKey',
  'eventSubscriptions',
  'binds'
]);
/** 支持的字段分类。 */
const fieldCategories = new Set<FieldCategory>(['basic', 'array', 'object']);
/** 支持的基础字段数据类型。 */
const dataTypes = new Set<DataType>(['string', 'number', 'boolean', 'date', 'datetime', 'time']);
/** 支持的标签位置。 */
const labelPositions = new Set<LabelPosition>(['left', 'top', 'right']);
/** 仅基础字段允许出现的属性。 */
const basicOnlyProperties = [
  'dataType',
  'component',
  'componentProperties',
  'componentData',
  'componentDataKey'
] as const;

/**
 * 深度校验未知输入是否为合法的 form-easy 表单 schema。
 *
 * 方法不会修改传入对象，也不会抛出普通配置错误；全部问题通过结构化结果返回。
 */
export function validateFormSchema(schema: unknown): FormSchemaValidationResult {
  const context = new SchemaValidationContext();
  validateSchemaRoot(schema, '$', context);
  const errors = context.issues.filter(issue => issue.level === 'error');
  const warnings = context.issues.filter(issue => issue.level === 'warning');
  return {
    valid: errors.length === 0,
    issues: context.issues,
    errors,
    warnings
  };
}

/** 校验表单根对象及其顶层字段。 */
function validateSchemaRoot(
  schema: unknown,
  path: string,
  context: SchemaValidationContext
): void {
  if (!isPlainRecord(schema)) {
    context.addError('invalid-type', path, '表单 schema 必须是普通对象。');
    return;
  }
  if (!enterSchemaNode(schema, path, context)) return;

  validateUnknownProperties(schema, formSchemaProperties, path, context);
  validateRequiredIdentifier(schema, 'key', path, '表单 key', context);
  validateRequiredNonEmptyString(schema, 'name', path, '表单名称', context);
  if (hasOwn(schema, 'labelPosition') && !labelPositions.has(schema.labelPosition as LabelPosition)) {
    context.addError(
      'invalid-value',
      propertyPath(path, 'labelPosition'),
      'labelPosition 必须是 left、top 或 right。'
    );
  }

  if (!hasOwn(schema, 'fields')) {
    context.addError('missing-property', propertyPath(path, 'fields'), '表单缺少必需的 fields 字段列表。');
  } else if (!Array.isArray(schema.fields)) {
    context.addError('invalid-type', propertyPath(path, 'fields'), '表单 fields 必须是数组。');
  } else {
    validateFieldList(schema.fields, propertyPath(path, 'fields'), context);
    if (typeof schema.key === 'string' && schema.key.trim()) {
      validateLocalFieldReferences(schema.key, schema.fields, propertyPath(path, 'fields'), context);
    }
  }
  context.activeSchemaNodes.delete(schema);
}

/** 校验同一层级的字段列表及字段 key 唯一性。 */
function validateFieldList(
  fields: unknown[],
  path: string,
  context: SchemaValidationContext
): void {
  const keyIndexes = new Map<string, number>();
  fields.forEach((field, index) => {
    const fieldPath = indexPath(path, index);
    if (isPlainRecord(field) && typeof field.key === 'string' && field.key.trim()) {
      const previousIndex = keyIndexes.get(field.key);
      if (previousIndex !== undefined) {
        context.addError(
          'duplicate-field-key',
          propertyPath(fieldPath, 'key'),
          `字段 key“${field.key}”与 ${indexPath(path, previousIndex)} 重复。`
        );
      } else {
        keyIndexes.set(field.key, index);
      }
    }
    validateField(field, fieldPath, true, context);
  });
}

/** 校验一个普通字段或数组元素定义。 */
function validateField(
  value: unknown,
  path: string,
  requiresIdentity: boolean,
  context: SchemaValidationContext
): void {
  if (!isPlainRecord(value)) {
    context.addError('invalid-type', path, '字段配置必须是普通对象。');
    return;
  }
  if (!enterSchemaNode(value, path, context)) return;

  validateUnknownProperties(value, formFieldProperties, path, context);
  validateFieldIdentity(value, path, requiresIdentity, context);
  validateOptionalPropertyTypes(value, path, context);
  validateFieldConfigurationConflicts(value, path, context);

  const category = value.category;
  if (!hasOwn(value, 'category')) {
    context.addError('missing-property', propertyPath(path, 'category'), '字段缺少必需的 category。');
  } else if (!fieldCategories.has(category as FieldCategory)) {
    context.addError('invalid-value', propertyPath(path, 'category'), '字段 category 必须是 basic、array 或 object。');
  } else {
    const field = value as unknown as FormField;
    validateSchemaRules(field, value.rules, propertyPath(path, 'rules'), context);
    validateFieldCategoryConfiguration(field, value, path, context);
    if (hasOwn(value, 'defaultValue')) {
      validateDefaultValue(field, value.defaultValue, propertyPath(path, 'defaultValue'), context);
    }
  }

  validateBindings(value.binds, propertyPath(path, 'binds'), context);
  validateEventSubscriptions(
    value.eventSubscriptions,
    propertyPath(path, 'eventSubscriptions'),
    context
  );
  context.activeSchemaNodes.delete(value);
}

/** 校验字段或数组元素定义是否正确配置 key 和 name。 */
function validateFieldIdentity(
  field: Record<string, unknown>,
  path: string,
  requiresIdentity: boolean,
  context: SchemaValidationContext
): void {
  if (requiresIdentity) {
    validateRequiredIdentifier(field, 'key', path, '字段 key', context);
    validateRequiredNonEmptyString(field, 'name', path, '字段名称', context);
    return;
  }
  (['key', 'name'] as const).forEach(property => {
    if (hasOwn(field, property)) {
      context.addError(
        'forbidden-property',
        propertyPath(path, property),
        `数组元素定义不应包含 ${property}。`
      );
    }
  });
}

/** 校验字段公共可选属性的类型。 */
function validateOptionalPropertyTypes(
  field: Record<string, unknown>,
  path: string,
  context: SchemaValidationContext
): void {
  validateOptionalType(field, 'required', 'boolean', path, context);
  validateOptionalType(field, 'hint', 'string', path, context);
  validateOptionalType(field, 'component', 'string', path, context, true);
  validateOptionalType(field, 'componentDataKey', 'string', path, context, true);
  validateComponentDataKeyExpression(field.componentDataKey, path, context);

  if (hasOwn(field, 'componentProperties') && !isPlainRecord(field.componentProperties)) {
    context.addError(
      'invalid-type',
      propertyPath(path, 'componentProperties'),
      'componentProperties 必须是普通对象。'
    );
  }
}

/** 校验 componentDataKey 调用表达式及参数引用的基础格式。 */
function validateComponentDataKeyExpression(
  value: unknown,
  fieldPath: string,
  context: SchemaValidationContext
): void {
  if (typeof value !== 'string' || !value.trim()) return;
  const path = propertyPath(fieldPath, 'componentDataKey');
  try {
    const expression = parseComponentDataExpression(value);
    expression.parameters.forEach(parameter => {
      const reference = parameter.fieldReference;
      const valid = isRelativeFieldReference(reference)
        ? Boolean(parseRelativeFieldReference(reference))
        : reference.includes('.');
      if (!valid) {
        context.addError(
          'invalid-value',
          path,
          `组件数据参数“${parameter.name}”的字段引用“${reference}”`
          + '格式无效。'
        );
      }
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    context.addError('invalid-value', path, `componentDataKey 表达式无效：${reason}`);
  }
}

/** 校验字段分类对应的必需属性和禁止属性。 */
function validateFieldCategoryConfiguration(
  field: FormField,
  rawField: Record<string, unknown>,
  path: string,
  context: SchemaValidationContext
): void {
  if (field.category === 'basic') {
    validateBasicField(field, rawField, path, context);
    validateForbiddenProperties(rawField, ['element', 'fields'], path, '基础字段', context);
    return;
  }

  validateForbiddenProperties(rawField, basicOnlyProperties, path, `${field.category} 字段`, context);
  if (field.category === 'array') {
    validateForbiddenProperties(rawField, ['fields'], path, '数组字段', context);
    if (!hasOwn(rawField, 'element')) {
      context.addError('missing-property', propertyPath(path, 'element'), '数组字段缺少必需的 element 元素定义。');
    } else {
      validateField(rawField.element, propertyPath(path, 'element'), false, context);
    }
    return;
  }

  validateForbiddenProperties(rawField, ['element'], path, '对象字段', context);
  if (!hasOwn(rawField, 'fields')) {
    context.addError('missing-property', propertyPath(path, 'fields'), '对象字段缺少必需的 fields 字段列表。');
  } else if (!Array.isArray(rawField.fields)) {
    context.addError('invalid-type', propertyPath(path, 'fields'), '对象字段的 fields 必须是数组。');
  } else {
    validateFieldList(rawField.fields, propertyPath(path, 'fields'), context);
  }
}

/** 校验基础字段的数据类型及专属属性。 */
function validateBasicField(
  field: FormField,
  rawField: Record<string, unknown>,
  path: string,
  context: SchemaValidationContext
): void {
  if (!hasOwn(rawField, 'dataType')) {
    context.addError('missing-property', propertyPath(path, 'dataType'), '基础字段缺少必需的 dataType。');
    return;
  }
  if (!dataTypes.has(field.dataType as DataType)) {
    context.addError(
      'invalid-value',
      propertyPath(path, 'dataType'),
      '基础字段 dataType 必须是 string、number、boolean、date、datetime 或 time。'
    );
  }
}
