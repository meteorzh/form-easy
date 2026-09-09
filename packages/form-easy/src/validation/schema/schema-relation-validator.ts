import type {
  ComponentEventName,
  ComponentHandle,
  FieldBinding
} from '../../types';
import {
  isSiblingFieldReference,
  readSiblingFieldKey
} from '../../field-reference';
import { SchemaValidationContext } from './schema-validation-context';
import {
  hasOwn,
  indexPath,
  isPlainRecord,
  propertyPath,
  validateRequiredEnumProperty,
  validateRequiredNonEmptyString,
  validateUnknownProperties
} from './schema-validation-utils';

/** 字段绑定对象允许配置的属性。 */
const bindingProperties = new Set(['sourceFormKey', 'sourceFieldId', 'target', 'resolver']);
/** 事件订阅对象允许配置的属性。 */
const eventSubscriptionProperties = new Set([
  'sourceFormKey',
  'sourceFieldKey',
  'eventName',
  'handle'
]);
/** 支持的字段绑定目标。 */
const bindingTargets = new Set<FieldBinding['target']>(['visible', 'enable', 'value']);
/** 支持的组件事件。 */
const componentEventNames = new Set<ComponentEventName>([
  'onShow',
  'onHide',
  'onDisabled',
  'onEnabled',
  'onClear',
  'onChange'
]);
/** 支持的组件操作命令。 */
const componentHandles = new Set<ComponentHandle>([
  'show',
  'hide',
  'disable',
  'enable',
  'clear',
  'change'
]);

/** 校验字段绑定列表。 */
export function validateBindings(
  bindingsValue: unknown,
  path: string,
  context: SchemaValidationContext
): void {
  if (bindingsValue === undefined) return;
  if (!Array.isArray(bindingsValue)) {
    context.addError('invalid-type', path, '字段 binds 必须是数组。');
    return;
  }
  const targetIndexes = new Map<FieldBinding['target'], number>();
  bindingsValue.forEach((bindingValue, index) => {
    const bindingPath = indexPath(path, index);
    if (!isPlainRecord(bindingValue)) {
      context.addError('invalid-type', bindingPath, '字段绑定必须是普通对象。');
      return;
    }
    validateUnknownProperties(bindingValue, bindingProperties, bindingPath, context);
    validateRequiredNonEmptyString(bindingValue, 'sourceFormKey', bindingPath, '绑定源表单 key', context);
    validateRequiredNonEmptyString(bindingValue, 'sourceFieldId', bindingPath, '绑定源字段标识', context);
    if (
      typeof bindingValue.sourceFormKey === 'string'
      && typeof bindingValue.sourceFieldId === 'string'
      && isSiblingFieldReference(bindingValue.sourceFieldId)
      && !readSiblingFieldKey(bindingValue.sourceFieldId)
    ) {
      context.addError(
        'invalid-value',
        propertyPath(bindingPath, 'sourceFieldId'),
        '同级 sourceFieldId 必须使用“./字段key”格式，且不能继续包含点号或方括号。'
      );
    } else if (
      typeof bindingValue.sourceFormKey === 'string'
      && typeof bindingValue.sourceFieldId === 'string'
      && !isSiblingFieldReference(bindingValue.sourceFieldId)
      && !bindingValue.sourceFieldId.startsWith(`${bindingValue.sourceFormKey}.`)
    ) {
      context.addError(
        'invalid-value',
        propertyPath(bindingPath, 'sourceFieldId'),
        'sourceFieldId 必须是以 sourceFormKey 开头的完整字段唯一标识，或使用“./字段key”引用同级字段。'
      );
    }
    if (!hasOwn(bindingValue, 'target')) {
      context.addError('missing-property', propertyPath(bindingPath, 'target'), '字段绑定缺少必需的 target。');
    } else if (!bindingTargets.has(bindingValue.target as FieldBinding['target'])) {
      context.addError('invalid-value', propertyPath(bindingPath, 'target'), '绑定 target 必须是 visible、enable 或 value。');
    } else {
      const target = bindingValue.target as FieldBinding['target'];
      const previousIndex = targetIndexes.get(target);
      if (previousIndex !== undefined) {
        context.addError(
          'duplicate-binding',
          propertyPath(bindingPath, 'target'),
          `绑定目标 ${target} 与 ${indexPath(path, previousIndex)} 重复。`
        );
      } else {
        targetIndexes.set(target, index);
      }
    }
    validateBindingResolver(bindingValue, bindingPath, context);
  });
}

/** 校验绑定 resolver 的类型和 JavaScript 函数体语法。 */
function validateBindingResolver(
  binding: Record<string, unknown>,
  path: string,
  context: SchemaValidationContext
): void {
  if (!hasOwn(binding, 'resolver')) return;
  if (typeof binding.resolver !== 'string' || !binding.resolver.trim()) {
    context.addError('invalid-type', propertyPath(path, 'resolver'), '绑定 resolver 必须是非空 JavaScript 字符串。');
    return;
  }
  try {
    new Function('sourceFieldValue', binding.resolver);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    context.addError(
      'invalid-value',
      propertyPath(path, 'resolver'),
      `绑定 resolver 不是有效的 JavaScript 函数体：${reason}`
    );
  }
}

/** 校验字段事件订阅列表。 */
export function validateEventSubscriptions(
  subscriptionsValue: unknown,
  path: string,
  context: SchemaValidationContext
): void {
  if (subscriptionsValue === undefined) return;
  if (!Array.isArray(subscriptionsValue)) {
    context.addError('invalid-type', path, '字段 eventSubscriptions 必须是数组。');
    return;
  }
  const subscriptionIndexes = new Map<string, number>();
  subscriptionsValue.forEach((subscriptionValue, index) => {
    const subscriptionPath = indexPath(path, index);
    if (!isPlainRecord(subscriptionValue)) {
      context.addError('invalid-type', subscriptionPath, '事件订阅必须是普通对象。');
      return;
    }
    validateUnknownProperties(subscriptionValue, eventSubscriptionProperties, subscriptionPath, context);
    validateRequiredNonEmptyString(subscriptionValue, 'sourceFormKey', subscriptionPath, '事件源表单 key', context);
    validateRequiredNonEmptyString(subscriptionValue, 'sourceFieldKey', subscriptionPath, '事件源字段标识', context);
    if (
      typeof subscriptionValue.sourceFormKey === 'string'
      && typeof subscriptionValue.sourceFieldKey === 'string'
      && !subscriptionValue.sourceFieldKey.startsWith(`${subscriptionValue.sourceFormKey}.`)
    ) {
      context.addError(
        'invalid-value',
        propertyPath(subscriptionPath, 'sourceFieldKey'),
        'sourceFieldKey 必须是以 sourceFormKey 开头的完整字段唯一标识。'
      );
    }
    validateRequiredEnumProperty(
      subscriptionValue,
      'eventName',
      componentEventNames,
      subscriptionPath,
      '事件 eventName',
      context
    );
    validateRequiredEnumProperty(
      subscriptionValue,
      'handle',
      componentHandles,
      subscriptionPath,
      '事件 handle',
      context
    );

    const signature = [
      subscriptionValue.sourceFormKey,
      subscriptionValue.sourceFieldKey,
      subscriptionValue.eventName,
      subscriptionValue.handle
    ].join('|');
    const previousIndex = subscriptionIndexes.get(signature);
    if (previousIndex !== undefined) {
      context.addWarning(
        'duplicate-subscription',
        subscriptionPath,
        `事件订阅与 ${indexPath(path, previousIndex)} 完全重复。`
      );
    } else {
      subscriptionIndexes.set(signature, index);
    }
  });
}

/** 校验会产生优先级覆盖的字段配置组合。 */
export function validateFieldConfigurationConflicts(
  field: Record<string, unknown>,
  path: string,
  context: SchemaValidationContext
): void {
  if (hasOwn(field, 'componentData') && hasOwn(field, 'componentDataKey')) {
    context.addWarning(
      'conflicting-configuration',
      path,
      'componentData 与 componentDataKey 同时配置时只会使用 componentData。'
    );
  }
  if (
    Array.isArray(field.binds)
    && field.binds.length > 0
    && Array.isArray(field.eventSubscriptions)
    && field.eventSubscriptions.length > 0
  ) {
    context.addWarning(
      'conflicting-configuration',
      path,
      'binds 与 eventSubscriptions 同时配置时只会使用 binds。'
    );
  }
}
