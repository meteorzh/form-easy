/** 同级字段引用使用的固定前缀。 */
export const SIBLING_FIELD_REFERENCE_PREFIX = './';

/** 判断字段引用是否使用同级字段语法。 */
export function isSiblingFieldReference(fieldReference: string): boolean {
  return fieldReference.startsWith(SIBLING_FIELD_REFERENCE_PREFIX);
}

/**
 * 从同级字段引用中读取字段 key。
 *
 * 同级引用只能包含一个字段 key，不支持继续跨层级访问。
 */
export function readSiblingFieldKey(fieldReference: string): string | undefined {
  if (!isSiblingFieldReference(fieldReference)) return undefined;
  const fieldKey = fieldReference.slice(SIBLING_FIELD_REFERENCE_PREFIX.length);
  if (!fieldKey || /[.\[\]]/.test(fieldKey)) return undefined;
  return fieldKey;
}

/** 根据当前目标字段标识将同级引用解析为完整字段标识。 */
export function resolveSiblingFieldId(
  targetFieldId: string,
  fieldReference: string
): string | undefined {
  const fieldKey = readSiblingFieldKey(fieldReference);
  const fieldKeySeparatorIndex = targetFieldId.lastIndexOf('.');
  if (!fieldKey || fieldKeySeparatorIndex < 0) return undefined;
  return `${targetFieldId.slice(0, fieldKeySeparatorIndex)}.${fieldKey}`;
}
