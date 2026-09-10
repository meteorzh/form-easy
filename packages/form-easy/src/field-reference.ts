/** 同级字段引用使用的固定前缀。 */
export const SIBLING_FIELD_REFERENCE_PREFIX = './';

/** 字段相对引用解析后的结构。 */
export interface RelativeFieldReference {
  /** 从当前字段所在容器向上移动的字段标识层数。 */
  parentLevels: number;
  /** 最终需要引用的字段 key。 */
  fieldKey: string;
}

/** 判断字段引用是否使用同级字段语法。 */
export function isSiblingFieldReference(fieldReference: string): boolean {
  return fieldReference.startsWith(SIBLING_FIELD_REFERENCE_PREFIX);
}

/** 判断字段引用是否使用同级或父级相对语法。 */
export function isRelativeFieldReference(fieldReference: string): boolean {
  return fieldReference.startsWith('./') || fieldReference.startsWith('../');
}

/**
 * 从同级字段引用中读取字段 key。
 *
 * 同级引用只能包含一个字段 key，不支持继续跨层级访问。
 */
export function readSiblingFieldKey(fieldReference: string): string | undefined {
  const reference = parseRelativeFieldReference(fieldReference);
  return reference?.parentLevels === 0 ? reference.fieldKey : undefined;
}

/** 解析 `./key` 或 `../../key` 形式的相对字段引用。 */
export function parseRelativeFieldReference(
  fieldReference: string
): RelativeFieldReference | undefined {
  let remainingReference = fieldReference.trim();
  let parentLevels = 0;
  if (remainingReference.startsWith('./')) {
    remainingReference = remainingReference.slice(2);
  } else {
    while (remainingReference.startsWith('../')) {
      parentLevels += 1;
      remainingReference = remainingReference.slice(3);
    }
    if (parentLevels === 0) return undefined;
  }
  if (!remainingReference || /[.\[\]/]/.test(remainingReference)) return undefined;
  return { parentLevels, fieldKey: remainingReference };
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

/** 根据当前目标字段标识解析同级或父级相对字段引用。 */
export function resolveRelativeFieldId(
  targetFieldId: string,
  fieldReference: string
): string | undefined {
  const reference = parseRelativeFieldReference(fieldReference);
  if (!reference) return undefined;

  let containerFieldId = removeLastFieldIdSegment(targetFieldId);
  if (!containerFieldId) return undefined;
  for (let level = 0; level < reference.parentLevels; level += 1) {
    containerFieldId = removeLastFieldIdSegment(containerFieldId);
    if (!containerFieldId) return undefined;
  }
  return `${containerFieldId}.${reference.fieldKey}`;
}

/** 从完整字段标识尾部移除一个字段或数组下标片段。 */
function removeLastFieldIdSegment(fieldId: string): string | undefined {
  if (/\[\d+\]$/.test(fieldId) || /\[\]$/.test(fieldId)) {
    return fieldId.replace(/\[(?:\d+)?\]$/, '') || undefined;
  }
  const separatorIndex = fieldId.lastIndexOf('.');
  return separatorIndex < 0 ? undefined : fieldId.slice(0, separatorIndex);
}
