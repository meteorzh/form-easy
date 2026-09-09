import { SchemaValidationContext } from './schema-validation-context';
import { indexPath, isPlainRecord, propertyPath } from './schema-validation-utils';

/** 校验当前表单内部事件和绑定引用的字段标识是否存在。 */
export function validateLocalFieldReferences(
  formKey: string,
  fields: unknown[],
  path: string,
  context: SchemaValidationContext
): void {
  const declaredFieldIds = new Set<string>();
  fields.forEach(field => collectFieldIds(field, formKey, declaredFieldIds, new WeakSet<object>()));
  fields.forEach((field, index) => {
    validateFieldReferences(
      field,
      indexPath(path, index),
      formKey,
      declaredFieldIds,
      new WeakSet<object>(),
      context
    );
  });
}

/** 递归收集字段定义可产生的标准字段标识模式。 */
function collectFieldIds(
  value: unknown,
  parentFieldId: string,
  fieldIds: Set<string>,
  visited: WeakSet<object>,
  anonymousFieldId?: string
): void {
  if (!isPlainRecord(value) || visited.has(value)) return;
  visited.add(value);
  const fieldId = anonymousFieldId
    ?? (typeof value.key === 'string' && value.key.trim()
      ? `${parentFieldId}.${value.key}`
      : undefined);
  if (!fieldId) return;
  fieldIds.add(fieldId);

  if (value.category === 'object' && Array.isArray(value.fields)) {
    value.fields.forEach(field => collectFieldIds(field, fieldId, fieldIds, visited));
  }
  if (value.category === 'array' && isPlainRecord(value.element)) {
    collectFieldIds(value.element, fieldId, fieldIds, visited, `${fieldId}[]`);
  }
}

/** 递归校验字段绑定和事件订阅中的当前表单字段引用。 */
function validateFieldReferences(
  value: unknown,
  path: string,
  formKey: string,
  fieldIds: ReadonlySet<string>,
  visited: WeakSet<object>,
  context: SchemaValidationContext
): void {
  if (!isPlainRecord(value) || visited.has(value)) return;
  visited.add(value);

  if (Array.isArray(value.binds)) {
    value.binds.forEach((binding, index) => {
      if (!isPlainRecord(binding) || binding.sourceFormKey !== formKey) return;
      validateLocalSourceFieldId(
        binding.sourceFieldId,
        propertyPath(indexPath(propertyPath(path, 'binds'), index), 'sourceFieldId'),
        fieldIds,
        context
      );
    });
  }
  if (Array.isArray(value.eventSubscriptions)) {
    value.eventSubscriptions.forEach((subscription, index) => {
      if (!isPlainRecord(subscription) || subscription.sourceFormKey !== formKey) return;
      validateLocalSourceFieldId(
        subscription.sourceFieldKey,
        propertyPath(indexPath(propertyPath(path, 'eventSubscriptions'), index), 'sourceFieldKey'),
        fieldIds,
        context
      );
    });
  }
  if (value.category === 'object' && Array.isArray(value.fields)) {
    value.fields.forEach((field, index) => {
      validateFieldReferences(
        field,
        indexPath(propertyPath(path, 'fields'), index),
        formKey,
        fieldIds,
        visited,
        context
      );
    });
  }
  if (value.category === 'array' && isPlainRecord(value.element)) {
    validateFieldReferences(
      value.element,
      propertyPath(path, 'element'),
      formKey,
      fieldIds,
      visited,
      context
    );
  }
}

/** 校验一个当前表单内的源字段完整标识。 */
function validateLocalSourceFieldId(
  value: unknown,
  path: string,
  fieldIds: ReadonlySet<string>,
  context: SchemaValidationContext
): void {
  if (typeof value !== 'string' || !value.trim()) return;
  const normalizedFieldId = value.replace(/\[\d+\]/g, '[]');
  if (!fieldIds.has(normalizedFieldId)) {
    context.addError(
      'unknown-source-field',
      path,
      `当前表单中不存在源字段“${value}”对应的字段定义。`
    );
  }
}
