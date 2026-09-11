import type {
  FieldValidationResult,
  FieldValidationRule,
  FieldValidationRuleType,
  FormField
} from '../types';

/** 不同字段类型允许使用的同步校验规则。 */
export const supportedRulesByFieldType: Readonly<Record<
  string,
  ReadonlySet<FieldValidationRuleType>
>> = {
  string: new Set(['minLength', 'maxLength', 'pattern', 'enum']),
  number: new Set(['min', 'max', 'enum']),
  boolean: new Set(['enum']),
  date: new Set(['min', 'max', 'enum']),
  datetime: new Set(['min', 'max', 'enum']),
  time: new Set(['min', 'max', 'enum']),
  array: new Set(['minLength', 'maxLength']),
  object: new Set(),
  record: new Set(['minLength', 'maxLength'])
};

/** 获取规则兼容性判断使用的字段类型名称。 */
export function getValidationFieldType(field: FormField): string {
  return field.category === 'basic'
    ? field.dataType ?? 'string'
    : field.category;
}

/** 校验规则是否适用于当前字段，并检查规则参数格式。 */
export function validateFieldRuleConfiguration(
  field: FormField,
  rule: FieldValidationRule
): FieldValidationResult {
  const fieldType = getValidationFieldType(field);
  const supportedRules = supportedRulesByFieldType[fieldType];
  if (!supportedRules?.has(rule.type)) {
    return createConfigurationError(
      rule.type,
      `${getFieldName(field)}的 ${fieldType} 类型不支持 ${rule.type} 校验规则。`
    );
  }

  if (rule.value === undefined) {
    return createConfigurationError(rule.type, `${getFieldName(field)}的 ${rule.type} 规则缺少 value。`);
  }
  if (rule.type === 'minLength' || rule.type === 'maxLength') {
    const valid = typeof rule.value === 'number'
      && Number.isInteger(rule.value)
      && rule.value >= 0;
    return valid
      ? { valid: true }
      : createConfigurationError(rule.type, `${getFieldName(field)}的 ${rule.type} 规则值必须是非负整数。`);
  }
  if (rule.type === 'min' || rule.type === 'max') {
    return normalizeRuleComparableValue(field, rule.value) !== undefined
      ? { valid: true }
      : createConfigurationError(rule.type, `${getFieldName(field)}的 ${rule.type} 规则值与字段数据类型不匹配。`);
  }
  if (rule.type === 'pattern') {
    return isValidValidationPattern(rule.value)
      ? { valid: true }
      : createConfigurationError(rule.type, `${getFieldName(field)}的 pattern 规则值不是有效的正则表达式。`);
  }
  if (rule.type === 'enum') {
    return Array.isArray(rule.value)
      ? { valid: true }
      : createConfigurationError(rule.type, `${getFieldName(field)}的 enum 规则值必须是数组。`);
  }
  return createConfigurationError(rule.type, `不支持的校验规则：${rule.type}。`);
}

/** 将支持范围校验的字段值转换为可比较数字。 */
export function normalizeRuleComparableValue(
  field: Pick<FormField, 'dataType'>,
  value: unknown
): number | undefined {
  if (field.dataType === 'number') {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }
  if (field.dataType === 'time' && typeof value === 'string') {
    const matched = /^(\d{2}):(\d{2})$/.exec(value);
    if (!matched) return undefined;
    const hours = Number(matched[1]);
    const minutes = Number(matched[2]);
    return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : undefined;
  }
  if ((field.dataType === 'date' || field.dataType === 'datetime') && typeof value === 'string') {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? undefined : timestamp;
  }
  return undefined;
}

/** 判断字符串能否构造有效的正则表达式。 */
function isValidValidationPattern(pattern: unknown): pattern is string {
  if (typeof pattern !== 'string') return false;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/** 获取用于规则配置错误信息的字段名称。 */
function getFieldName(field: FormField): string {
  return field.name ? `“${field.name}”` : '当前字段';
}

/** 创建规则配置错误结果。 */
function createConfigurationError(
  ruleType: FieldValidationRuleType,
  message: string
): FieldValidationResult {
  return {
    valid: false,
    errorType: 'configuration',
    ruleType,
    message
  };
}
