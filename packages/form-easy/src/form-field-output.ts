import {
  resolveFormFieldNode,
  type FormFieldDefinitions
} from './form-field-definition-resolver';
import type { FormField } from './types';

/** 生成字段输出时使用的运行时上下文。 */
export interface FormFieldOutputOptions {
  /** schema 中的可复用字段定义。 */
  definitions?: FormFieldDefinitions;
  /** 允许递归生成输出的最大深度。 */
  maxDepth?: number;
  /** 当前字段的递归深度。 */
  depth?: number;
  /** 当前字段的完整唯一标识。 */
  fieldId?: string;
  /** 按完整唯一标识读取字段当前是否可见。 */
  isFieldVisible?: (fieldId: string) => boolean;
}

/** 判断命名字段是否应从父级输出对象中省略。 */
export function shouldOmitNamedFieldOutput(
  field: FormField,
  value: unknown,
  visible = true
): boolean {
  const omitNull = field.omitNull === true
    && (value === null || value === undefined);
  const omitHidden = field.omitWhenHidden === true && !visible;
  return omitNull || omitHidden;
}

/**
 * 将命名字段写入输出对象；满足空值或隐藏省略策略时删除对应属性。
 *
 * 该方法只影响对外输出对象，不修改字段内部状态或 FormValueStore。
 */
export function assignNamedFieldValue(
  output: Record<string, unknown>,
  field: FormField,
  value: unknown,
  options: FormFieldOutputOptions = {}
): void {
  if (!field.key) return;
  const visible = options.fieldId && options.isFieldVisible
    ? options.isFieldVisible(options.fieldId)
    : true;
  if (shouldOmitNamedFieldOutput(field, value, visible)) {
    delete output[field.key];
    return;
  }
  output[field.key] = createFieldOutputValue(field, value, options);
}

/** 根据字段结构递归生成对外输出值，并处理嵌套命名字段的省略策略。 */
export function createFieldOutputValue(
  field: FormField,
  value: unknown,
  options: FormFieldOutputOptions = {}
): unknown {
  const definitions = options.definitions ?? {};
  const maxDepth = options.maxDepth ?? 32;
  const depth = options.depth ?? 0;
  const normalizedValue = value === undefined ? null : value;
  if (depth >= maxDepth || normalizedValue === null) return normalizedValue;

  if (field.category === 'object' && isValueRecord(normalizedValue)) {
    const output: Record<string, unknown> = {};
    (field.fields ?? []).forEach(fieldNode => {
      const childField = resolveFormFieldNode(fieldNode, definitions);
      if (!childField?.key) return;
      assignNamedFieldValue(
        output,
        childField,
        normalizedValue[childField.key],
        {
          ...options,
          definitions,
          maxDepth,
          depth: depth + 1,
          fieldId: options.fieldId
            ? `${options.fieldId}.${childField.key}`
            : undefined
        }
      );
    });
    return output;
  }

  if (field.category === 'array' && Array.isArray(normalizedValue)) {
    const element = field.element
      ? resolveFormFieldNode(field.element, definitions)
      : undefined;
    return element
      ? normalizedValue.map((item, index) => createFieldOutputValue(
        element,
        item,
        {
          ...options,
          definitions,
          maxDepth,
          depth: depth + 1,
          fieldId: options.fieldId
            ? `${options.fieldId}[${index}]`
            : undefined
        }
      ))
      : [...normalizedValue];
  }

  if (field.category === 'record' && isValueRecord(normalizedValue)) {
    const valueField = field.kvDef
      ? resolveFormFieldNode(field.kvDef.value, definitions)
      : undefined;
    if (!valueField) return { ...normalizedValue };
    return Object.fromEntries(
      Object.entries(normalizedValue).map(([key, item], index) => [
        key,
        createFieldOutputValue(
          valueField,
          item,
          {
            ...options,
            definitions,
            maxDepth,
            depth: depth + 1,
            fieldId: options.fieldId
              ? `${options.fieldId}[${index}].value`
              : undefined
          }
        )
      ])
    );
  }

  return normalizedValue;
}

/** 根据完整 schema 字段列表生成只包含可输出字段的表单数据。 */
export function createFormOutputData(
  fields: readonly unknown[],
  formData: Record<string, unknown>,
  formKey: string,
  options: Omit<FormFieldOutputOptions, 'depth' | 'fieldId'> = {}
): Record<string, unknown> {
  const definitions = options.definitions ?? {};
  const output: Record<string, unknown> = {};
  fields.forEach(fieldNode => {
    const field = resolveFormFieldNode(fieldNode, definitions);
    if (!field?.key) return;
    assignNamedFieldValue(output, field, formData[field.key], {
      ...options,
      definitions,
      depth: 0,
      fieldId: `${formKey}.${field.key}`
    });
  });
  return output;
}

/** 判断未知值是否为可以读取命名子字段的对象。 */
function isValueRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
