import type { ComponentDataKey } from './types';

/** 组件数据调用表达式中的单个动态参数。 */
export interface ComponentDataExpressionParameter {
  /** 传递给 ComponentDataResolver 的参数名。 */
  name: string;
  /** 参数值所引用的字段标识。 */
  fieldReference: string;
}

/** 解析完成的组件数据调用表达式。 */
export interface ComponentDataExpression {
  /** ComponentDataManager 中注册的解析器 key。 */
  key: ComponentDataKey;
  /** 需要从字段事件中解析的动态参数。 */
  parameters: ComponentDataExpressionParameter[];
}

/** 参数名允许使用的标识符格式。 */
const parameterNamePattern = /^[A-Za-z_$][\w$]*$/;

/**
 * 解析 componentDataKey 的普通 key 或带参数调用表达式。
 *
 * 支持 `key` 与 `key(name:fieldReference)` 两种形式，不执行任意代码。
 */
export function parseComponentDataExpression(value: string): ComponentDataExpression {
  const expression = value.trim();
  if (!expression) throw new Error('componentDataKey 不能为空。');

  const openingParenthesisIndex = expression.indexOf('(');
  if (openingParenthesisIndex < 0) {
    if (expression.includes(')')) {
      throw new Error('componentDataKey 包含未配对的右括号。');
    }
    return { key: expression, parameters: [] };
  }
  if (!expression.endsWith(')')) {
    throw new Error('组件数据调用表达式必须以右括号结束。');
  }

  const key = expression.slice(0, openingParenthesisIndex).trim();
  const parameterSource = expression.slice(openingParenthesisIndex + 1, -1).trim();

  if (!key) throw new Error('组件数据调用表达式缺少解析器 key。');
  if (parameterSource.includes('(') || parameterSource.includes(')')) {
    throw new Error('组件数据调用表达式不支持嵌套括号。');
  }
  if (!parameterSource) return { key, parameters: [] };

  const parameterNames = new Set<string>();
  const parameters = parameterSource.split(',').map((parameter, index) => {
    const separatorIndex = parameter.indexOf(':');
    if (separatorIndex < 0 || parameter.indexOf(':', separatorIndex + 1) >= 0) {
      throw new Error(
        `第 ${index + 1} 个参数必须使用“参数名:字段引用”格式。`
      );
    }
    const name = parameter.slice(0, separatorIndex).trim();
    const fieldReference = parameter.slice(separatorIndex + 1).trim();
    if (!parameterNamePattern.test(name)) {
      throw new Error(`参数名“${name}”不是有效的 JavaScript 标识符。`);
    }
    if (!fieldReference) throw new Error(`参数“${name}”缺少字段引用。`);
    if (parameterNames.has(name)) throw new Error(`参数名“${name}”重复。`);
    parameterNames.add(name);
    return { name, fieldReference };
  });

  return { key, parameters };
}
