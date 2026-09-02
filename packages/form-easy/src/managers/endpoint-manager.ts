import type { EndpointKey, FormField } from '../types';

/** 调用异步服务端点时由框架提供的上下文。 */
export interface EndpointContext<TInput = unknown> {
  /** 当前调用的端点键。 */
  endpointKey: EndpointKey;
  /** 当前所属表单键。 */
  formKey: string;
  /** 当前字段完整唯一标识。 */
  fieldId: string;
  /** 当前字段配置。 */
  field: FormField;
  /** 本次服务调用的输入数据。 */
  input: TInput;
  /** 用于取消过期请求的信号。 */
  signal: AbortSignal;
}

/** 异步服务端点的执行函数。 */
export type EndpointHandler<TInput = unknown, TResult = unknown> = (
  context: EndpointContext<TInput>
) => TResult | Promise<TResult>;

/** 按端点键管理表单异步服务调用的注册中心。 */
export class EndpointManager {
  /** 已注册端点执行函数。 */
  private readonly handlers = new Map<EndpointKey, EndpointHandler>();

  /** 注册或替换一个端点执行函数。 */
  register<TInput, TResult>(
    endpointKey: EndpointKey,
    handler: EndpointHandler<TInput, TResult>
  ): void {
    this.handlers.set(endpointKey, handler as EndpointHandler);
  }

  /** 移除一个端点执行函数。 */
  unregister(endpointKey: EndpointKey): void {
    this.handlers.delete(endpointKey);
  }

  /** 调用指定端点，并在未注册时抛出明确错误。 */
  async invoke<TInput, TResult>(
    endpointKey: EndpointKey,
    context: Omit<EndpointContext<TInput>, 'endpointKey'>
  ): Promise<TResult> {
    const handler = this.handlers.get(endpointKey);
    if (!handler) throw new Error(`未找到端点“${endpointKey}”的处理函数。`);
    return handler({ ...context, endpointKey }) as Promise<TResult>;
  }
}

/** 通过全局 Symbol 键保存运行时对象的全局对象类型。 */
const globalEndpointManagerStore = globalThis as { [key: symbol]: unknown };

/** 跨打包入口共享端点管理器的全局 Symbol 键。 */
const ENDPOINT_MANAGER_KEY = Symbol.for('form-easy.endpoint-manager');

/** 注册全局端点管理器；传入 undefined 可取消全局配置。 */
export function registerGlobalEndpointManager(endpointManager?: EndpointManager): void {
  globalEndpointManagerStore[ENDPOINT_MANAGER_KEY] = endpointManager;
}

/** 获取当前全局端点管理器。 */
export function getGlobalEndpointManager(): EndpointManager | undefined {
  return globalEndpointManagerStore[ENDPOINT_MANAGER_KEY] as EndpointManager | undefined;
}
