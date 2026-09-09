import type { FormSchema } from '../../types';
import type { FormSchemaValidationResult } from '../../validation/schema';

/** form-easy-creator 输出 schema 时携带的事件数据。 */
export interface FormEasyCreatorChangeDetail {
  /** 当前设计器生成的表单 schema。 */
  schema: FormSchema;
  /** 当前生成 schema 的静态校验结果。 */
  validation: FormSchemaValidationResult;
}
