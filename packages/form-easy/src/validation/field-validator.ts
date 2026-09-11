import type {
  FieldValidationResult,
  FieldValidationRule,
  FieldValidationRuleType,
  FormField
} from '../types';
import {
  normalizeRuleComparableValue,
  validateFieldRuleConfiguration
} from './rule-configuration-validator';

/** 校验一个字段值，并返回第一个未通过的规则。 */
export function validateFieldValue(
  field: FormField,
  value: unknown
): FieldValidationResult {
  if (field.required && isEmptyValue(value)) {
    return {
      valid: false,
      errorType: 'value',
      message: `${getFieldName(field)}不能为空。`
    };
  }
  for (const rule of field.rules ?? []) {
    const configurationResult = validateFieldRuleConfiguration(field, rule);
    if (!configurationResult.valid) return configurationResult;
    const result = validateRule(field, value, rule);
    if (!result.valid) return result;
  }
  return { valid: true };
}

/** 执行单条同步校验规则。 */
function validateRule(
  field: FormField,
  value: unknown,
  rule: FieldValidationRule
): FieldValidationResult {
  if (isEmptyValue(value)) return { valid: true };

  if (rule.type === 'minLength' || rule.type === 'maxLength') {
    const length = getValueLength(value);
    const limit = typeof rule.value === 'number' ? rule.value : Number.NaN;
    const valid = length !== undefined
      && Number.isFinite(limit)
      && (rule.type === 'minLength' ? length >= limit : length <= limit);
    const description = rule.type === 'minLength' ? '不能少于' : '不能超过';
    return createResult(valid, rule, `${getFieldName(field)}长度${description}${String(rule.value)}。`);
  }

  if (rule.type === 'min' || rule.type === 'max') {
    const comparison = compareValues(field, value, rule.value);
    const valid = comparison !== undefined
      && (rule.type === 'min' ? comparison >= 0 : comparison <= 0);
    const description = rule.type === 'min' ? '不能小于' : '不能大于';
    return createResult(valid, rule, `${getFieldName(field)}${description}${String(rule.value)}。`);
  }

  if (rule.type === 'pattern') {
    const valid = validatePattern(value, rule.value);
    return createResult(valid, rule, `${getFieldName(field)}格式不正确。`);
  }

  if (rule.type === 'enum') {
    const valid = Array.isArray(rule.value)
      && rule.value.some(item => Object.is(item, value));
    return createResult(valid, rule, `${getFieldName(field)}不是允许的值。`);
  }

  return createUnsupportedRuleResult(rule.type);
}

/** 创建单条规则的标准校验结果。 */
function createResult(
  valid: boolean,
  rule: FieldValidationRule,
  defaultMessage: string
): FieldValidationResult {
  return valid
    ? { valid: true }
    : {
      valid: false,
      errorType: 'value',
      ruleType: rule.type,
      message: rule.message ?? defaultMessage
    };
}

/** 判断值是否属于必填校验中的空值。 */
function isEmptyValue(value: unknown): boolean {
  return value === undefined
    || value === null
    || value === ''
    || (Array.isArray(value) && value.length === 0);
}

/** 获取字符串或数组的长度。 */
function getValueLength(value: unknown): number | undefined {
  if (typeof value === 'string' || Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length;
  }
  return undefined;
}

/** 比较数字、日期、日期时间或时间值。 */
function compareValues(
  field: FormField,
  value: unknown,
  boundary: unknown
): number | undefined {
  const currentValue = normalizeRuleComparableValue(field, value);
  const boundaryValue = normalizeRuleComparableValue(field, boundary);
  if (currentValue === undefined || boundaryValue === undefined) return undefined;
  return currentValue - boundaryValue;
}

/** 使用字符串形式的正则表达式校验字段值。 */
function validatePattern(value: unknown, pattern: unknown): boolean {
  if (typeof value !== 'string' || typeof pattern !== 'string') return false;
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return false;
  }
}

/** 获取用于默认校验错误信息的字段名称。 */
function getFieldName(field: FormField): string {
  return field.name ? `“${field.name}”` : '当前字段';
}

/** 为未来无法识别的规则返回配置错误。 */
function createUnsupportedRuleResult(
  ruleType: FieldValidationRuleType
): FieldValidationResult {
  return {
    valid: false,
    errorType: 'configuration',
    ruleType,
    message: `不支持的校验规则：${ruleType}。`
  };
}
