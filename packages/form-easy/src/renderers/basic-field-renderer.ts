import type { FormField } from '../types';

/** 基础字段渲染器接收的运行时上下文。 */
export interface BasicFieldRenderContext {
  /** 当前字段定义。 */
  field: FormField;
  /** 当前字段的完整唯一标识。 */
  fieldId: string;
  /** 当前字段值。 */
  value: unknown;
  /** 当前字段是否禁用。 */
  disabled: boolean;
  /** 将渲染器中的值变更同步回表单字段。 */
  onChange: (value: unknown) => void;
}

/** 基础字段渲染适配器的生命周期约定。 */
export interface BasicFieldRenderer {
  /** 在稳定的宿主元素中挂载或更新基础字段。 */
  render(host: HTMLElement, context: BasicFieldRenderContext): void;
  /** 卸载宿主元素中由适配器创建的视图。 */
  unmount(host: HTMLElement): void;
}

/** 跨打包入口共享基础字段渲染适配器的全局 Symbol 键。 */
const BASIC_FIELD_RENDERER_KEY = Symbol.for('form-easy.basic-field-renderer');

/** 可通过 Symbol 键保存运行时对象的全局对象类型。 */
const globalRendererStore = globalThis as { [key: symbol]: unknown };

/** 注册全局基础字段渲染适配器；传入 undefined 可恢复原生 H5 渲染。 */
export function registerBasicFieldRenderer(renderer?: BasicFieldRenderer): void {
  globalRendererStore[BASIC_FIELD_RENDERER_KEY] = renderer;
}

/** 获取当前已注册的基础字段渲染适配器。 */
export function getBasicFieldRenderer(): BasicFieldRenderer | undefined {
  return globalRendererStore[BASIC_FIELD_RENDERER_KEY] as BasicFieldRenderer | undefined;
}
