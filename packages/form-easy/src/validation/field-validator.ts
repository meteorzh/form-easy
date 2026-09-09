import type {
  FieldValidationResult,
  FieldValidationRule,
  FieldValidationRuleType,
  FormField
} from '../types';

/** 校验一个字段值，并返回第一个未通过的规则。 */
export function validateFieldValue(
  field: FormField,
  value: unknown
): FieldValidationResult {
  const rules = createEffectiveRules(field);
  for (const rule of rules) {
    const configurationResult = validateRuleConfiguration(field, rule);
    if (!configurationResult.valid) return configurationResult;
    const result = validateRule(field, value, rule);
    if (!result.valid) return result;
  }
  return { valid: true };
}

/** 不同字段类型允许使用的同步校验规则。 */
const supportedRulesByFieldType: Readonly<Record<string, ReadonlySet<FieldValidationRuleType>>> = {
  string: new Set(['required', 'minLength', 'maxLength', 'pattern', 'enum']),
  number: new Set(['required', 'min', 'max', 'enum']),
  boolean: new Set(['required', 'enum']),
  date: new Set(['required', 'min', 'max', 'enum']),
  datetime: new Set(['required', 'min', 'max', 'enum']),
  time: new Set(['required', 'min', 'max', 'enum']),
  array: new Set(['required', 'minLength', 'maxLength']),
  object: new Set(['required'])
};

/** 校验规则是否适用于当前字段，并检查规则参数格式。 */
function validateRuleConfiguration(
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

  if (rule.type === 'minLength' || rule.type === 'maxLength') {
    const valid = typeof rule.value === 'number'
      && Number.isInteger(rule.value)
      && rule.value >= 0;
    return valid
      ? { valid: true }
      : createConfigurationError(rule.type, `${getFieldName(field)}的 ${rule.type} 规则值必须是非负整数。`);
  }
  if (rule.type === 'min' || rule.type === 'max') {
    return normalizeComparableValue(field, rule.value) !== undefined
      ? { valid: true }
      : createConfigurationError(rule.type, `${getFieldName(field)}的 ${rule.type} 规则值与字段数据类型不匹配。`);
  }
  if (rule.type === 'pattern') {
    return isValidPattern(rule.value)
      ? { valid: true }
      : createConfigurationError(rule.type, `${getFieldName(field)}的 pattern 规则值不是有效的正则表达式。`);
  }
  if (rule.type === 'enum') {
    return Array.isArray(rule.value)
      ? { valid: true }
      : createConfigurationError(rule.type, `${getFieldName(field)}的 enum 规则值必须是数组。`);
  }
  return { valid: true };
}

/** 合并 required 快捷配置和显式规则，避免重复校验。 */
function createEffectiveRules(field: FormField): FieldValidationRule[] {
  const rules = field.rules ?? [];
  if (!field.required || rules.some(rule => rule.type === 'required')) return rules;
  return [{ type: 'required' }, ...rules];
}

/** 执行单条同步校验规则。 */
function validateRule(
  field: FormField,
  value: unknown,
  rule: FieldValidationRule
): FieldValidationResult {
  if (rule.type === 'required') {
    return createResult(
      !isEmptyValue(value),
      rule,
      `${getFieldName(field)}不能为空。`
    );
  }
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
  return typeof value === 'string' || Array.isArray(value)
    ? value.length
    : undefined;
}

/** 比较数字、日期、日期时间或时间值。 */
function compareValues(
  field: FormField,
  value: unknown,
  boundary: unknown
): number | undefined {
  const currentValue = normalizeComparableValue(field, value);
  const boundaryValue = normalizeComparableValue(field, boundary);
  if (currentValue === undefined || boundaryValue === undefined) return undefined;
  return currentValue - boundaryValue;
}

/** 将支持范围校验的字段值转换为数字。 */
function normalizeComparableValue(field: FormField, value: unknown): number | undefined {
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

/** 使用字符串形式的正则表达式校验字段值。 */
function validatePattern(value: unknown, pattern: unknown): boolean {
  if (typeof value !== 'string' || typeof pattern !== 'string') return false;
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return false;
  }
}

/** 判断规则值能否构造有效的正则表达式。 */
function isValidPattern(pattern: unknown): pattern is string {
  if (typeof pattern !== 'string') return false;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/** 获取字段规则兼容性判断使用的类型名称。 */
function getValidationFieldType(field: FormField): string {
  return field.category === 'basic'
    ? field.dataType ?? 'string'
    : field.category;
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

/** 创建 schema 校验规则配置错误结果。 */
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
