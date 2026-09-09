import type {
  FormSchemaValidationIssue,
  FormSchemaValidationIssueCode,
  FormSchemaValidationIssueLevel
} from './schema-validation-types';

/** schema 深度校验过程中共享的问题收集与循环引用状态。 */
export class SchemaValidationContext {
  /** 已收集的全部问题。 */
  readonly issues: FormSchemaValidationIssue[] = [];
  /** 当前递归路径上的 schema 对象。 */
  readonly activeSchemaNodes = new WeakSet<object>();
  /** 当前递归路径上的默认值对象。 */
  readonly activeDefaultValues = new WeakSet<object>();

  /** 添加一个结构化校验问题。 */
  addIssue(
    level: FormSchemaValidationIssueLevel,
    code: FormSchemaValidationIssueCode,
    path: string,
    message: string
  ): void {
    this.issues.push({ level, code, path, message });
  }

  /** 添加一个会令校验失败的错误。 */
  addError(code: FormSchemaValidationIssueCode, path: string, message: string): void {
    this.addIssue('error', code, path, message);
  }

  /** 添加一个不阻止 schema 使用但需要开发者关注的警告。 */
  addWarning(code: FormSchemaValidationIssueCode, path: string, message: string): void {
    this.addIssue('warning', code, path, message);
  }
}
