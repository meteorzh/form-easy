import type {
  ComponentEventName,
  ComponentHandle,
  FieldBinding
} from '../../types';
import {
  isRelativeFieldReference,
  parseRelativeFieldReference
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
const bindingProperties = new Set([
  'target',
  'params',
  'resolver'
]);
/** 事件订阅对象允许配置的属性。 */
const eventSubscriptionProperties = new Set([
  'sourceFormKey',
  'sourceFieldKey',
  'eventName',
  'handle'
]);
/** 支持的字段绑定目标。 */
const bindingTargets = new Set<FieldBinding['target']>(['visible', 'enable', 'value']);
/** 绑定 resolver 参数名允许使用的标识符格式。 */
const bindingParameterNamePattern = /^[A-Za-z_$][\w$]*$/;
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
  const targetBindingIndexes = new Map<FieldBinding['target'], number>();
  bindingsValue.forEach((bindingValue, index) => {
    const bindingPath = indexPath(path, index);
    if (!isPlainRecord(bindingValue)) {
      context.addError('invalid-type', bindingPath, '字段绑定必须是普通对象。');
      return;
    }
    validateUnknownProperties(bindingValue, bindingProperties, bindingPath, context);
    const parameterNames = validateBindingParams(bindingValue, bindingPath, context);
    if (!hasOwn(bindingValue, 'target')) {
      context.addError('missing-property', propertyPath(bindingPath, 'target'), '字段绑定缺少必需的 target。');
    } else if (!bindingTargets.has(bindingValue.target as FieldBinding['target'])) {
      context.addError('invalid-value', propertyPath(bindingPath, 'target'), '绑定 target 必须是 visible、enable 或 value。');
    } else {
      const target = bindingValue.target as FieldBinding['target'];
      const previousIndex = targetBindingIndexes.get(target);
      if (previousIndex !== undefined) {
        context.addError(
          'duplicate-binding',
          propertyPath(bindingPath, 'target'),
          `绑定目标 ${target} 与 ${indexPath(path, previousIndex)} 重复。`
        );
      } else {
        targetBindingIndexes.set(target, index);
      }
    }
    if (
      parameterNames.length > 1
      && !hasOwn(bindingValue, 'resolver')
    ) {
      context.addError(
        'missing-property',
        propertyPath(bindingPath, 'resolver'),
        '包含多个源参数的绑定必须配置 resolver。'
      );
    }
    validateBindingResolver(bindingValue, bindingPath, parameterNames, context);
  });
}

/** 校验绑定源参数名、字段引用格式并返回合法参数名。 */
function validateBindingParams(
  binding: Record<string, unknown>,
  bindingPath: string,
  context: SchemaValidationContext
): string[] {
  const paramsPath = propertyPath(bindingPath, 'params');
  if (!hasOwn(binding, 'params')) {
    context.addError('missing-property', paramsPath, '字段绑定缺少必需的 params。');
    return [];
  }
  if (!isPlainRecord(binding.params)) {
    context.addError('invalid-type', paramsPath, '字段绑定 params 必须是普通对象。');
    return [];
  }
  const entries = Object.entries(binding.params);
  if (entries.length === 0) {
    context.addError('invalid-value', paramsPath, '字段绑定 params 至少需要一个源参数。');
    return [];
  }
  const parameterNames: string[] = [];
  entries.forEach(([name, fieldReference]) => {
    const parameterPath = propertyPath(paramsPath, name);
    if (!isValidBindingParameterName(name)) {
      context.addError(
        'invalid-value',
        parameterPath,
        `绑定参数名“${name}”不是合法的 JavaScript 函数参数名。`
      );
      return;
    }
    parameterNames.push(name);
    if (typeof fieldReference !== 'string' || !fieldReference.trim()) {
      context.addError('invalid-type', parameterPath, '绑定参数的字段引用必须是非空字符串。');
      return;
    }
    if (isRelativeFieldReference(fieldReference)) {
      if (!parseRelativeFieldReference(fieldReference)) {
        context.addError(
          'invalid-value',
          parameterPath,
          '相对字段引用必须使用“./字段key”或“../字段key”格式。'
        );
      }
      return;
    }
    if (!fieldReference.includes('.')) {
      context.addError(
        'invalid-value',
        parameterPath,
        '完整字段引用必须包含表单 key 和字段路径。'
      );
    }
  });
  return parameterNames;
}

/** 判断参数名能否安全用作 new Function 的独立参数。 */
function isValidBindingParameterName(name: string): boolean {
  if (!bindingParameterNamePattern.test(name)) return false;
  try {
    new Function(name, 'return undefined;');
    return true;
  } catch {
    return false;
  }
}

/** 校验绑定 resolver 的类型、参数和 JavaScript 函数体语法。 */
function validateBindingResolver(
  binding: Record<string, unknown>,
  path: string,
  parameterNames: string[],
  context: SchemaValidationContext
): void {
  if (!hasOwn(binding, 'resolver')) return;
  if (typeof binding.resolver !== 'string' || !binding.resolver.trim()) {
    context.addError('invalid-type', propertyPath(path, 'resolver'), '绑定 resolver 必须是非空 JavaScript 字符串。');
    return;
  }
  try {
    new Function(...parameterNames, binding.resolver);
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
