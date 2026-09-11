/** 表单 schema 问题的严重级别。 */
export type FormSchemaValidationIssueLevel = 'error' | 'warning';

/** 表单 schema 校验使用的稳定问题代码。 */
export type FormSchemaValidationIssueCode =
  | 'invalid-type'
  | 'invalid-value'
  | 'missing-property'
  | 'unknown-property'
  | 'forbidden-property'
  | 'duplicate-field-key'
  | 'duplicate-rule'
  | 'duplicate-binding'
  | 'duplicate-subscription'
  | 'incompatible-rule'
  | 'invalid-rule-configuration'
  | 'conflicting-configuration'
  | 'invalid-default-value'
  | 'unknown-default-field'
  | 'unknown-source-field'
  | 'unknown-field-definition'
  | 'circular-reference';

/** 描述一个可定位的表单 schema 配置问题。 */
export interface FormSchemaValidationIssue {
  /** 问题严重级别。 */
  level: FormSchemaValidationIssueLevel;
  /** 便于程序判断问题类型的稳定代码。 */
  code: FormSchemaValidationIssueCode;
  /** 问题在 schema 中的 JSON 风格路径。 */
  path: string;
  /** 面向开发者的中文问题说明。 */
  message: string;
}

/** 深度校验一个表单 schema 后返回的结构化结果。 */
export interface FormSchemaValidationResult {
  /** schema 是否不存在 error 级别问题。 */
  valid: boolean;
  /** 校验发现的全部错误和警告。 */
  issues: FormSchemaValidationIssue[];
  /** 仅包含 error 级别问题。 */
  errors: FormSchemaValidationIssue[];
  /** 仅包含 warning 级别问题。 */
  warnings: FormSchemaValidationIssue[];
}
