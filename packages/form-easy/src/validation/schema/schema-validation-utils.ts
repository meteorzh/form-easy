import { SchemaValidationContext } from './schema-validation-context';

/** 校验对象是否包含未知属性。 */
export function validateUnknownProperties(
  value: Record<string, unknown>,
  allowedProperties: ReadonlySet<string>,
  path: string,
  context: SchemaValidationContext
): void {
  Object.keys(value).forEach(property => {
    if (!allowedProperties.has(property)) {
      context.addError(
        'unknown-property',
        propertyPath(path, property),
        `不支持的配置属性“${property}”。`
      );
    }
  });
}

/** 校验当前字段分类禁止出现的属性。 */
export function validateForbiddenProperties(
  field: Record<string, unknown>,
  properties: readonly string[],
  path: string,
  fieldDescription: string,
  context: SchemaValidationContext
): void {
  properties.forEach(property => {
    if (hasOwn(field, property)) {
      context.addError(
        'forbidden-property',
        propertyPath(path, property),
        `${fieldDescription}不应配置 ${property}。`
      );
    }
  });
}

/** 校验必需的非空字符串属性。 */
export function validateRequiredNonEmptyString(
  value: Record<string, unknown>,
  property: string,
  path: string,
  description: string,
  context: SchemaValidationContext
): void {
  const targetPath = propertyPath(path, property);
  if (!hasOwn(value, property)) {
    context.addError('missing-property', targetPath, `${description}是必需属性。`);
  } else if (typeof value[property] !== 'string' || !value[property].trim()) {
    context.addError('invalid-type', targetPath, `${description}必须是非空字符串。`);
  }
}

/** 校验用于字段标识的必需字符串，并阻止破坏字段路径语法的字符。 */
export function validateRequiredIdentifier(
  value: Record<string, unknown>,
  property: string,
  path: string,
  description: string,
  context: SchemaValidationContext
): void {
  validateRequiredNonEmptyString(value, property, path, description, context);
  const identifier = value[property];
  if (typeof identifier === 'string' && /[.\[\]]/.test(identifier)) {
    context.addError(
      'invalid-value',
      propertyPath(path, property),
      `${description}不能包含点号或方括号，以免破坏字段唯一标识。`
    );
  }
}

/** 校验一个可选属性的基础类型和非空字符串要求。 */
export function validateOptionalType(
  value: Record<string, unknown>,
  property: string,
  expectedType: 'boolean' | 'string',
  path: string,
  context: SchemaValidationContext,
  requireNonEmpty = false
): void {
  if (!hasOwn(value, property)) return;
  if (
    typeof value[property] !== expectedType
    || (requireNonEmpty && typeof value[property] === 'string' && !value[property].trim())
  ) {
    context.addError(
      'invalid-type',
      propertyPath(path, property),
      `${property} 必须是${requireNonEmpty ? '非空' : ''}${expectedType === 'string' ? '字符串' : '布尔值'}。`
    );
  }
}

/** 校验一个必需属性是否属于指定枚举集合。 */
export function validateRequiredEnumProperty<T extends string>(
  value: Record<string, unknown>,
  property: string,
  allowedValues: ReadonlySet<T>,
  path: string,
  description: string,
  context: SchemaValidationContext
): void {
  const targetPath = propertyPath(path, property);
  if (!hasOwn(value, property)) {
    context.addError('missing-property', targetPath, `${description}是必需属性。`);
  } else if (!allowedValues.has(value[property] as T)) {
    context.addError('invalid-value', targetPath, `${description}的值“${String(value[property])}”不受支持。`);
  }
}

/** 进入一个 schema 递归节点，并在检测到循环引用时记录错误。 */
export function enterSchemaNode(
  value: object,
  path: string,
  context: SchemaValidationContext
): boolean {
  if (context.activeSchemaNodes.has(value)) {
    context.addError('circular-reference', path, 'schema 中存在循环引用，无法继续递归校验。');
    return false;
  }
  context.activeSchemaNodes.add(value);
  return true;
}

/** 进入一个默认值递归节点，并在检测到循环引用时记录错误。 */
export function enterDefaultValue(
  value: object,
  path: string,
  context: SchemaValidationContext
): boolean {
  if (context.activeDefaultValues.has(value)) {
    context.addError('circular-reference', path, 'defaultValue 中存在循环引用。');
    return false;
  }
  context.activeDefaultValues.add(value);
  return true;
}

/** 判断未知值是否为 JSON schema 可使用的普通对象。 */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** 判断对象自身是否声明指定属性。 */
export function hasOwn(value: Record<string, unknown>, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
}

/** 拼接对象属性对应的校验路径。 */
export function propertyPath(path: string, property: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(property)
    ? `${path}.${property}`
    : `${path}[${JSON.stringify(property)}]`;
}

/** 拼接数组索引对应的校验路径。 */
export function indexPath(path: string, index: number): string {
  return `${path}[${index}]`;
}
