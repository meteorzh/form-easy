import { defineCustomElements } from '@wenzhencn/form-easy/loader';

let customElementsReady: Promise<void> | undefined;

/**
 * 确保 form-easy 的自定义元素只初始化一次。
 *
 * 多个 Vue 包装组件同时挂载时会共享同一个 Promise，避免重复执行注册逻辑。
 * 初始化失败时清理缓存，使后续组件挂载仍然可以重新尝试初始化。
 */
export function ensureFormEasyCustomElements(): Promise<void> {
  if (!customElementsReady) {
    customElementsReady = Promise.resolve(defineCustomElements()).catch(
      (error: unknown) => {
        customElementsReady = undefined;
        throw error;
      }
    );
  }

  return customElementsReady;
}
