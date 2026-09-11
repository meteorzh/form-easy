import {
  isRelativeFieldReference,
  isSiblingFieldReference,
  parseRelativeFieldReference,
  readSiblingFieldKey,
  resolveRelativeFieldId,
  resolveSiblingFieldId
} from '../../field-reference';
import { parseComponentDataExpression } from '../../component-data-expression';
import {
  isFormFieldReference,
  resolveFormFieldNode,
  type FormFieldDefinitions
} from '../../form-field-definition-resolver';
import { SchemaValidationContext } from './schema-validation-context';
import { indexPath, isPlainRecord, propertyPath } from './schema-validation-utils';

/** 校验当前表单内部事件和绑定引用的字段标识是否存在。 */
export function validateLocalFieldReferences(
  formKey: string,
  fields: unknown[],
  path: string,
  context: SchemaValidationContext,
  definitions: FormFieldDefinitions = {}
): void {
  const declaredFieldIds = new Set<string>();
  fields.forEach(field => collectFieldIds(
    field,
    formKey,
    declaredFieldIds,
    new WeakSet<object>(),
    definitions,
    new Set<string>()
  ));
  fields.forEach((field, index) => {
    const fieldId = createFieldId(field, formKey, definitions);
    validateFieldReferences(
      field,
      indexPath(path, index),
      formKey,
      declaredFieldIds,
      fieldId,
      new WeakSet<object>(),
      definitions,
      new Set<string>(),
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
  definitions: FormFieldDefinitions,
  activeDefinitionNames: Set<string>,
  anonymousFieldId?: string
): void {
  if (!isPlainRecord(value) || visited.has(value)) return;
  visited.add(value);
  const referenceName = isFormFieldReference(value) ? value.$ref : undefined;
  const field = resolveFormFieldNode(value, definitions);
  if (!field) return;

  const fieldId = anonymousFieldId
    ?? (typeof field.key === 'string' && field.key.trim()
      ? `${parentFieldId}.${field.key}`
      : undefined);
  if (!fieldId) return;
  fieldIds.add(fieldId);
  if (referenceName && activeDefinitionNames.has(referenceName)) return;
  const childActiveDefinitionNames = new Set(activeDefinitionNames);
  if (referenceName) childActiveDefinitionNames.add(referenceName);

  if (field.category === 'object' && Array.isArray(field.fields)) {
    field.fields.forEach(childField => collectFieldIds(
      childField,
      fieldId,
      fieldIds,
      visited,
      definitions,
      childActiveDefinitionNames
    ));
  }
  if (field.category === 'array' && isPlainRecord(field.element)) {
    collectFieldIds(
      field.element,
      fieldId,
      fieldIds,
      visited,
      definitions,
      childActiveDefinitionNames,
      `${fieldId}[]`
    );
  }
  if (field.category === 'record' && isPlainRecord(field.kvDef?.value)) {
    fieldIds.add(`${fieldId}[].key`);
    collectFieldIds(
      field.kvDef.value,
      fieldId,
      fieldIds,
      visited,
      definitions,
      childActiveDefinitionNames,
      `${fieldId}[].value`
    );
  }
}

/** 校验组件数据调用表达式中的字段参数引用是否存在。 */
function validateComponentDataParameterReferences(
  value: unknown,
  path: string,
  formKey: string,
  currentFieldId: string | undefined,
  fieldIds: ReadonlySet<string>,
  context: SchemaValidationContext
): void {
  if (typeof value !== 'string' || !value.trim()) return;
  let expression;
  try {
    expression = parseComponentDataExpression(value);
  } catch {
    return;
  }

  expression.parameters.forEach(parameter => {
    const reference = parameter.fieldReference;
    if (isRelativeFieldReference(reference)) {
      if (!parseRelativeFieldReference(reference)) return;
      const sourceFieldId = currentFieldId
        ? resolveRelativeFieldId(currentFieldId, reference)
        : undefined;
      if (!sourceFieldId || !fieldIds.has(sourceFieldId)) {
        context.addError(
          'unknown-source-field',
          path,
          `组件数据参数“${parameter.name}”引用的字段“${reference}”不存在。`
        );
      }
      return;
    }

    if (!reference.startsWith(`${formKey}.`)) return;
    validateLocalSourceFieldId(reference, path, fieldIds, context);
  });
}

/** 递归校验字段绑定和事件订阅中的当前表单字段引用。 */
function validateFieldReferences(
  value: unknown,
  path: string,
  formKey: string,
  fieldIds: ReadonlySet<string>,
  currentFieldId: string | undefined,
  visited: WeakSet<object>,
  definitions: FormFieldDefinitions,
  activeDefinitionNames: Set<string>,
  context: SchemaValidationContext
): void {
  if (!isPlainRecord(value) || visited.has(value)) return;
  visited.add(value);
  const referenceName = isFormFieldReference(value) ? value.$ref : undefined;
  const field = resolveFormFieldNode(value, definitions);
  if (!field) return;

  validateComponentDataParameterReferences(
    field.componentDataKey,
    propertyPath(path, 'componentDataKey'),
    formKey,
    currentFieldId,
    fieldIds,
    context
  );

  if (Array.isArray(field.binds)) {
    field.binds.forEach((binding, index) => {
      if (!isPlainRecord(binding)) return;
      const sourceFieldPath = propertyPath(
        indexPath(propertyPath(path, 'binds'), index),
        'sourceFieldId'
      );
      if (
        typeof binding.sourceFieldId === 'string'
        && isSiblingFieldReference(binding.sourceFieldId)
      ) {
        validateSiblingSourceFieldId(
          binding.sourceFormKey,
          binding.sourceFieldId,
          sourceFieldPath,
          formKey,
          currentFieldId,
          fieldIds,
          context
        );
        return;
      }
      if (binding.sourceFormKey !== formKey) return;
      validateLocalSourceFieldId(
        binding.sourceFieldId,
        sourceFieldPath,
        fieldIds,
        context
      );
    });
  }
  if (Array.isArray(field.eventSubscriptions)) {
    field.eventSubscriptions.forEach((subscription, index) => {
      if (!isPlainRecord(subscription) || subscription.sourceFormKey !== formKey) return;
      validateLocalSourceFieldId(
        subscription.sourceFieldKey,
        propertyPath(indexPath(propertyPath(path, 'eventSubscriptions'), index), 'sourceFieldKey'),
        fieldIds,
        context
      );
    });
  }
  if (referenceName && activeDefinitionNames.has(referenceName)) return;
  const childActiveDefinitionNames = new Set(activeDefinitionNames);
  if (referenceName) childActiveDefinitionNames.add(referenceName);

  if (field.category === 'object' && Array.isArray(field.fields)) {
    field.fields.forEach((childField, index) => {
      const childFieldId = currentFieldId
        ? createFieldId(childField, currentFieldId, definitions)
        : undefined;
      validateFieldReferences(
        childField,
        indexPath(propertyPath(path, 'fields'), index),
        formKey,
        fieldIds,
        childFieldId,
        visited,
        definitions,
        childActiveDefinitionNames,
        context
      );
    });
  }
  if (field.category === 'array' && isPlainRecord(field.element)) {
    const elementFieldId = currentFieldId ? `${currentFieldId}[]` : undefined;
    validateFieldReferences(
      field.element,
      propertyPath(path, 'element'),
      formKey,
      fieldIds,
      elementFieldId,
      visited,
      definitions,
      childActiveDefinitionNames,
      context
    );
  }
  if (field.category === 'record' && isPlainRecord(field.kvDef?.value)) {
    const keyFieldId = currentFieldId
      ? `${currentFieldId}[].key`
      : undefined;
    validateComponentDataParameterReferences(
      field.kvDef.key.componentDataKey,
      propertyPath(
        propertyPath(propertyPath(path, 'kvDef'), 'key'),
        'componentDataKey'
      ),
      formKey,
      keyFieldId,
      fieldIds,
      context
    );
    const valueFieldId = currentFieldId
      ? `${currentFieldId}[].value`
      : undefined;
    validateFieldReferences(
      field.kvDef.value,
      propertyPath(propertyPath(path, 'kvDef'), 'value'),
      formKey,
      fieldIds,
      valueFieldId,
      visited,
      definitions,
      childActiveDefinitionNames,
      context
    );
  }
}

/** 根据父级标识和字段 key 创建当前字段的声明标识。 */
function createFieldId(
  value: unknown,
  parentFieldId: string,
  definitions: FormFieldDefinitions
): string | undefined {
  const field = isPlainRecord(value)
    ? resolveFormFieldNode(value, definitions)
    : undefined;
  return field && typeof field.key === 'string' && field.key.trim()
    ? `${parentFieldId}.${field.key}`
    : undefined;
}

/** 校验同级字段引用能否在当前字段所在结构中解析。 */
function validateSiblingSourceFieldId(
  sourceFormKey: unknown,
  sourceFieldReference: string,
  path: string,
  formKey: string,
  currentFieldId: string | undefined,
  fieldIds: ReadonlySet<string>,
  context: SchemaValidationContext
): void {
  if (!readSiblingFieldKey(sourceFieldReference)) return;
  if (sourceFormKey !== formKey) {
    context.addError(
      'invalid-value',
      path,
      '同级字段引用只能引用当前字段所属表单。'
    );
    return;
  }
  const sourceFieldId = currentFieldId
    ? resolveSiblingFieldId(currentFieldId, sourceFieldReference)
    : undefined;
  if (!sourceFieldId || !fieldIds.has(sourceFieldId)) {
    context.addError(
      'unknown-source-field',
      path,
      `当前字段所在结构中不存在同级源字段“${sourceFieldReference}”。`
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
