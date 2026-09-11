import type {
  FormField,
  FormFieldDefinition,
  FormFieldNode,
  FormFieldReference
} from './types';

/** 表单 schema 中按名称保存的可复用字段定义集合。 */
export type FormFieldDefinitions = Readonly<Record<string, FormFieldDefinition>>;

/** 判断字段节点是否是 definitions 引用。 */
export function isFormFieldReference(
  node: FormFieldNode | unknown
): node is FormFieldReference {
  return Boolean(node)
    && typeof node === 'object'
    && !Array.isArray(node)
    && Object.prototype.hasOwnProperty.call(node, '$ref');
}

/**
 * 将一个字段引用浅解析为可渲染字段。
 *
 * 方法只展开当前节点，模板内部的嵌套引用继续保留到对应层级实际渲染时
 * 解析，从而允许数组和延迟创建对象安全地使用递归定义。
 */
export function resolveFormFieldNode(
  node: FormFieldNode | unknown,
  definitions: FormFieldDefinitions = {}
): FormField | undefined {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return undefined;
  if (!isFormFieldReference(node)) return node as FormField;
  const definition = definitions[node.$ref];
  if (!definition) return undefined;
  const { $ref: _referenceName, ...overrides } = node;
  return {
    ...definition,
    ...overrides
  } as FormField;
}

/** 解析字段节点，引用不存在时抛出包含定义名称的明确错误。 */
export function requireResolvedFormField(
  node: FormFieldNode | unknown,
  definitions: FormFieldDefinitions = {}
): FormField {
  const field = resolveFormFieldNode(node, definitions);
  if (field) return field;
  const referenceName = isFormFieldReference(node) ? node.$ref : '未知定义';
  throw new Error(`未找到字段定义：${referenceName}。`);
}
