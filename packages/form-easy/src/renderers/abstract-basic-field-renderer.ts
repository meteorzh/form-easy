import { ComponentRegistry } from '../managers/component-registry';
import {
  getDefaultBasicFieldComponentKey,
  type BasicFieldComponentKey
} from '../types';
import type { BasicFieldRenderContext, BasicFieldRenderer } from './basic-field-renderer';

/** 组件解析后得到的基础字段渲染结果。 */
interface ResolvedBasicFieldComponent<TComponent> {
  /** 实际参与查询的组件键。 */
  componentKey: BasicFieldComponentKey;
  /** 查询到的已注册组件。 */
  component?: TComponent;
  /** 显式自定义组件未注册时需要展示的错误信息。 */
  errorMessage?: string;
}

/** 统一处理组件注册、解析和缺失组件提示的基础字段渲染器抽象类。 */
export abstract class AbstractBasicFieldRenderer<TComponent> implements BasicFieldRenderer {
  /** 当前渲染器实例独立维护的组件注册中心。 */
  readonly componentRegistry = new ComponentRegistry<TComponent>();

  /** 解析字段组件，并调用具体渲染器实现完成视图渲染。 */
  render(host: HTMLElement, context: BasicFieldRenderContext): void {
    const result = this.resolveComponent(context);
    if (result.component) {
      this.renderRegisteredComponent(host, result.component, context);
      return;
    }
    if (result.errorMessage) {
      this.renderMissingComponentError(host, result.errorMessage);
      return;
    }
    this.renderDefaultField(host, context);
  }

  /** 卸载宿主元素中的具体框架视图。 */
  abstract unmount(host: HTMLElement): void;

  /** 渲染已注册的字段组件。 */
  protected abstract renderRegisteredComponent(
    host: HTMLElement,
    component: TComponent,
    context: BasicFieldRenderContext
  ): void;

  /** 渲染当前数据类型的默认 H5 输入控件。 */
  protected abstract renderDefaultField(
    host: HTMLElement,
    context: BasicFieldRenderContext
  ): void;

  /** 渲染显式配置的自定义组件不存在时的错误视图。 */
  protected abstract renderMissingComponentError(host: HTMLElement, message: string): void;

  /** 解析字段实际使用的组件，区分默认回退和显式自定义组件缺失。 */
  private resolveComponent(
    context: BasicFieldRenderContext
  ): ResolvedBasicFieldComponent<TComponent> {
    const defaultComponentKey = getDefaultBasicFieldComponentKey(context.field.dataType);
    const componentKey = context.field.component ?? defaultComponentKey;
    const component = this.componentRegistry.get(componentKey);
    const isMissingExplicitCustomComponent = Boolean(context.field.component)
      && componentKey !== defaultComponentKey
      && !component;
    return {
      componentKey,
      component,
      errorMessage: isMissingExplicitCustomComponent
        ? `未找到字段组件：${componentKey}。`
        : undefined
    };
  }
}
