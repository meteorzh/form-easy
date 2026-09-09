import type {
  FieldValidationRule,
  FieldValidationRuleType,
  FormField
} from '../../types';
import {
  normalizeRuleComparableValue,
  validateFieldRuleConfiguration
} from '../rule-configuration-validator';
import { SchemaValidationContext } from './schema-validation-context';
import {
  hasOwn,
  indexPath,
  isPlainRecord,
  propertyPath,
  validateUnknownProperties
} from './schema-validation-utils';

/** 校验规则对象允许配置的属性。 */
const validationRuleProperties = new Set(['type', 'value', 'message']);
/** 支持的同步校验规则类型。 */
const validationRuleTypes = new Set<FieldValidationRuleType>([
  'required',
  'minLength',
  'maxLength',
  'min',
  'max',
  'pattern',
  'enum'
]);

/** 校验字段规则列表、规则兼容性和规则间关系。 */
export function validateSchemaRules(
  field: FormField,
  rulesValue: unknown,
  path: string,
  context: SchemaValidationContext
): void {
  if (rulesValue === undefined) return;
  if (!Array.isArray(rulesValue)) {
    context.addError('invalid-type', path, '字段 rules 必须是数组。');
    return;
  }

  const seenRuleTypes = new Map<FieldValidationRuleType, number>();
  const validRules: FieldValidationRule[] = [];
  rulesValue.forEach((ruleValue, index) => {
    const rulePath = indexPath(path, index);
    if (!isPlainRecord(ruleValue)) {
      context.addError('invalid-type', rulePath, '校验规则必须是普通对象。');
      return;
    }
    validateUnknownProperties(ruleValue, validationRuleProperties, rulePath, context);
    if (hasOwn(ruleValue, 'message') && typeof ruleValue.message !== 'string') {
      context.addError('invalid-type', propertyPath(rulePath, 'message'), '规则 message 必须是字符串。');
    }
    if (!hasOwn(ruleValue, 'type')) {
      context.addError('missing-property', propertyPath(rulePath, 'type'), '校验规则缺少必需的 type。');
      return;
    }
    if (!validationRuleTypes.has(ruleValue.type as FieldValidationRuleType)) {
      context.addError('invalid-value', propertyPath(rulePath, 'type'), `不支持的校验规则类型“${String(ruleValue.type)}”。`);
      return;
    }

    const rule = ruleValue as unknown as FieldValidationRule;
    if (rule.type === 'required' && hasOwn(ruleValue, 'value') && rule.value === undefined) {
      context.addError('forbidden-property', propertyPath(rulePath, 'value'), 'required 规则不应配置 value。');
    }
    const previousIndex = seenRuleTypes.get(rule.type);
    if (previousIndex !== undefined) {
      context.addError(
        'duplicate-rule',
        propertyPath(rulePath, 'type'),
        `规则 ${rule.type} 与 ${indexPath(path, previousIndex)} 重复。`
      );
    } else {
      seenRuleTypes.set(rule.type, index);
    }
    const configurationResult = validateFieldRuleConfiguration(field, rule);
    if (!configurationResult.valid) {
      context.addError(
        configurationResult.message?.includes('不支持') ? 'incompatible-rule' : 'invalid-rule-configuration',
        rulePath,
        configurationResult.message ?? `规则 ${rule.type} 配置无效。`
      );
    } else {
      validRules.push(rule);
    }
    if (rule.type === 'enum' && Array.isArray(rule.value) && rule.value.length === 0) {
      context.addWarning(
        'invalid-rule-configuration',
        propertyPath(rulePath, 'value'),
        'enum 规则值为空数组，任何非空字段值都无法通过该规则。'
      );
    }
  });
  validateRuleRanges(field, validRules, path, context);
}

/** 校验 min/max 与 minLength/maxLength 的上下界关系。 */
function validateRuleRanges(
  field: FormField,
  rules: FieldValidationRule[],
  path: string,
  context: SchemaValidationContext
): void {
  const minLength = rules.find(rule => rule.type === 'minLength');
  const maxLength = rules.find(rule => rule.type === 'maxLength');
  if (
    typeof minLength?.value === 'number'
    && typeof maxLength?.value === 'number'
    && minLength.value > maxLength.value
  ) {
    context.addError('invalid-rule-configuration', path, 'minLength 不能大于 maxLength。');
  }

  const min = rules.find(rule => rule.type === 'min');
  const max = rules.find(rule => rule.type === 'max');
  if (!min || !max) return;
  const minValue = normalizeRuleComparableValue(field, min.value);
  const maxValue = normalizeRuleComparableValue(field, max.value);
  if (minValue !== undefined && maxValue !== undefined && minValue > maxValue) {
    context.addError('invalid-rule-configuration', path, 'min 不能大于 max。');
  }
}
