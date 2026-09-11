import {
  resolveFormFieldNode,
  type FormFieldDefinitions
} from '../../form-field-definition-resolver';
import type { DataType, FormField, FormFieldNode } from '../../types';
import { normalizeRuleComparableValue } from '../rule-configuration-validator';
import { SchemaValidationContext } from './schema-validation-context';
import {
  enterDefaultValue,
  indexPath,
  isPlainRecord,
  propertyPath
} from './schema-validation-utils';

/** 按字段分类递归校验 defaultValue 的数据结构。 */
export function validateDefaultValue(
  field: FormField,
  value: unknown,
  path: string,
  context: SchemaValidationContext,
  definitions: FormFieldDefinitions = {}
): void {
  if (value === null || value === undefined) return;
  if (field.category === 'basic') {
    validateBasicDefaultValue(field.dataType, value, path, context);
    return;
  }
  if (field.category === 'array') {
    if (!Array.isArray(value)) {
      context.addError('invalid-default-value', path, '数组字段的 defaultValue 必须是数组或 null。');
      return;
    }
    if (!enterDefaultValue(value, path, context)) return;
    value.forEach((item, index) => {
      const element = field.element
        ? resolveFormFieldNode(field.element, definitions)
        : undefined;
      if (element) {
        validateDefaultValue(
          element,
          item,
          indexPath(path, index),
          context,
          definitions
        );
      }
    });
    context.activeDefaultValues.delete(value);
    return;
  }
  if (field.category === 'record') {
    validateRecordDefaultValue(field, value, path, context, definitions);
    return;
  }
  if (!isPlainRecord(value)) {
    context.addError('invalid-default-value', path, '对象字段的 defaultValue 必须是普通对象或 null。');
    return;
  }
  if (!enterDefaultValue(value, path, context)) return;
  validateObjectDefaultValue(
    field.fields ?? [],
    value,
    path,
    context,
    definitions
  );
  context.activeDefaultValues.delete(value);
}

/** 校验 record 默认值的对象结构以及每一个动态属性值。 */
function validateRecordDefaultValue(
  field: FormField,
  value: unknown,
  path: string,
  context: SchemaValidationContext,
  definitions: FormFieldDefinitions
): void {
  if (!isPlainRecord(value)) {
    context.addError(
      'invalid-default-value',
      path,
      'record 字段的 defaultValue 必须是普通对象或 null。'
    );
    return;
  }
  if (!enterDefaultValue(value, path, context)) return;
  const valueField = field.kvDef
    ? resolveFormFieldNode(field.kvDef.value, definitions)
    : undefined;
  if (valueField) {
    Object.entries(value).forEach(([key, item]) => {
      validateDefaultValue(
        valueField,
        item,
        propertyPath(path, key),
        context,
        definitions
      );
    });
  }
  context.activeDefaultValues.delete(value);
}

/** 校验基础字段 defaultValue 是否匹配 dataType。 */
function validateBasicDefaultValue(
  dataType: DataType | undefined,
  value: unknown,
  path: string,
  context: SchemaValidationContext
): void {
  let valid = false;
  if (dataType === 'string') valid = typeof value === 'string';
  if (dataType === 'number') valid = typeof value === 'number' && Number.isFinite(value);
  if (dataType === 'boolean') valid = typeof value === 'boolean';
  if (dataType === 'date') valid = typeof value === 'string' && isValidDate(value);
  if (dataType === 'datetime') {
    valid = typeof value === 'string'
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
      && !Number.isNaN(Date.parse(value));
  }
  if (dataType === 'time') {
    valid = normalizeRuleComparableValue({ dataType: 'time' }, value) !== undefined;
  }
  if (!valid) {
    context.addError(
      'invalid-default-value',
      path,
      `defaultValue 与基础字段 dataType“${String(dataType)}”不匹配。`
    );
  }
}

/** 校验对象默认值中的已声明字段、未知字段及嵌套值。 */
function validateObjectDefaultValue(
  fields: FormFieldNode[],
  value: Record<string, unknown>,
  path: string,
  context: SchemaValidationContext,
  definitions: FormFieldDefinitions
): void {
  const resolvedFields = fields.flatMap(fieldNode => {
    const field = resolveFormFieldNode(fieldNode, definitions);
    return field ? [field] : [];
  });
  const fieldsByKey = new Map(
    resolvedFields
      .filter(field => field.key)
      .map(field => [field.key!, field])
  );
  Object.entries(value).forEach(([key, item]) => {
    const childPath = propertyPath(path, key);
    const childField = fieldsByKey.get(key);
    if (!childField) {
      context.addError(
        'unknown-default-field',
        childPath,
        `对象 defaultValue 包含 schema fields 中未声明的字段“${key}”。`
      );
      return;
    }
    validateDefaultValue(
      childField,
      item,
      childPath,
      context,
      definitions
    );
  });
}

/** 判断 YYYY-MM-DD 字符串是否表示真实存在的日期。 */
function isValidDate(value: string): boolean {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!matched) return false;
  const date = new Date(Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])));
  return date.getUTCFullYear() === Number(matched[1])
    && date.getUTCMonth() === Number(matched[2]) - 1
    && date.getUTCDate() === Number(matched[3]);
}
