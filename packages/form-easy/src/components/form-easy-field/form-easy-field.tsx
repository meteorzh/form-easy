import { Component, Event, EventEmitter, h, Method, Prop, State, Watch } from '@stencil/core';
import { componentRegistry } from '../../managers/component-registry';
import { getGlobalComponentDataResolver } from '../../managers/component-data-resolver';
import { globalEventCenter, type EventCenter } from '../../managers/event-center';
import { getGlobalBasicFieldRenderer } from '../../renderers/basic-field-renderer';
import type { BasicFieldRenderer } from '../../renderers/basic-field-renderer';
import type {
  ComponentEventName,
  ComponentHandle,
  ComponentDataResolver,
  EventFlowHistory,
  FieldBinding,
  FormField,
  HandleTarget,
  LabelPosition
} from '../../types';

/** 渲染单个字段，并提供通用的 form-easy 组件操作。 */
@Component({ tag: 'form-easy-field', styleUrl: 'form-easy-field.css' })
export class FormEasyField implements HandleTarget {
  /** 待渲染的字段定义。 */
  @Prop() field!: FormField;
  /** 分配给当前字段的完整唯一标识。 */
  @Prop() fieldId!: string;
  /** 当前字段值。 */
  @Prop() value: unknown;
  /** 用于解析事件源标识的表单键。 */
  @Prop() formKey!: string;
  /** 字段标签相对于编辑器的位置。 */
  @Prop() labelPosition: LabelPosition = 'left';
  /**
   * 当前字段所属表单指定的基础字段渲染器。
   * undefined 使用全局渲染器，null 强制使用默认 H5 渲染。
   */
  @Prop() basicFieldRenderer?: BasicFieldRenderer | null;
  /** 当前表单覆盖全局配置的组件数据解析器。 */
  @Prop() componentDataResolver?: ComponentDataResolver;
  /** 表单内所有字段共用的事件路由器。 */
  @Prop() eventCenter: EventCenter = globalEventCenter;
  /** 向父级渲染器通知字段值变更。 */
  @Event() valueChange!: EventEmitter<unknown>;

  /** 当前可见状态。 */
  @State() private visible = true;
  /** 当前禁用状态。 */
  @State() private disabled = false;
  /** 本地维护的字段值。 */
  @State() private currentValue: unknown;
  /** 已为当前组件准备完成的数据。 */
  @State() private componentData: unknown;
  /** 组件数据是否仍在加载。 */
  @State() private componentDataLoading = false;
  /** 组件数据加载失败时保留的错误。 */
  @State() private componentDataError?: Error;
  /** 已注册事件订阅的清理回调。 */
  private unsubscribe: Array<() => void> = [];
  /** 供框架渲染适配器挂载视图的稳定宿主元素。 */
  private rendererHost?: HTMLDivElement;
  /** 上一次实际用于渲染的适配器，用于切换时正确卸载。 */
  private activeRenderer?: BasicFieldRenderer;
  /** 用于取消已过期组件数据请求的控制器。 */
  private componentDataAbortController?: AbortController;

  /** 初始化本地字段值和事件订阅。 */
  componentWillLoad(): void {
    this.currentValue = this.value ?? null;
    this.registerSubscriptions();
    void this.prepareComponentData();
  }

  /** 将根表单传入的新字段值同步到当前字段。 */
  @Watch('value')
  syncExternalValue(newValue: unknown): void {
    this.currentValue = newValue ?? null;
  }

  /** 字段配置更新后重新解析组件数据。 */
  @Watch('field')
  reloadComponentData(): void {
    void this.prepareComponentData();
  }

  /** 表单级解析器更新后重新解析组件数据。 */
  @Watch('componentDataResolver')
  reloadComponentDataResolver(): void {
    void this.prepareComponentData();
  }

  /** 当前字段被移除时释放事件订阅。 */
  disconnectedCallback(): void {
    this.unsubscribe.forEach(cleanup => cleanup());
    this.unsubscribe = [];
    this.componentDataAbortController?.abort();
    if (this.rendererHost) this.activeRenderer?.unmount(this.rendererHost);
  }

  /** 字段完成首次挂载后调用已注册的框架渲染适配器。 */
  componentDidLoad(): void {
    this.renderWithAdapter();
  }

  /** 字段状态或属性更新后同步更新已注册的框架渲染适配器。 */
  componentDidUpdate(): void {
    this.renderWithAdapter();
  }

  /** 供事件中心或外部代码执行标准操作命令。 */
  @Method()
  async applyHandle(
    handle: ComponentHandle,
    value?: unknown,
    history: EventFlowHistory = []
  ): Promise<void> {
    if (handle === 'show' && !this.visible) {
      this.visible = true;
      this.publish('onShow', undefined, history);
    }
    if (handle === 'hide' && this.visible) {
      this.visible = false;
      this.publish('onHide', undefined, history);
    }
    if (handle === 'disable' && !this.disabled) {
      this.disabled = true;
      this.publish('onDisabled', undefined, history);
    }
    if (handle === 'enable' && this.disabled) {
      this.disabled = false;
      this.publish('onEnabled', undefined, history);
    }
    if (handle === 'clear' && this.currentValue !== undefined) {
      this.updateValue(this.createDefaultValue(), 'onClear', history);
    }
    if (handle === 'change' && value !== this.currentValue) {
      this.updateValue(value, 'onChange', history);
    }
  }

  /** 处理嵌套对象或数组字段触发的值。 */
  private onNestedValueChange = (event: CustomEvent<unknown>): void => {
    event.stopPropagation();
    this.updateValue(event.detail, 'onChange');
  };

  /** 处理原生基础控件的值变更。 */
  private onInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    const value = this.field.dataType === 'boolean' ? target.checked : this.field.dataType === 'number' ? Number(target.value) : target.value;
    this.updateValue(value, 'onChange');
  };

  /** 更新本地状态、冒泡值事件并路由配置的事件。 */
  private updateValue(
    value: unknown,
    eventName: ComponentEventName,
    history: EventFlowHistory = []
  ): void {
    this.currentValue = value;
    this.valueChange.emit(value);
    this.publish(eventName, value, history);
  }

  /** 通过共享事件中心发布组件事件。 */
  private publish(
    eventName: ComponentEventName,
    value?: unknown,
    history: EventFlowHistory = []
  ): void {
    this.eventCenter.publish(this.fieldId, eventName, value, history);
  }

  /** 注册当前字段声明的所有事件订阅。 */
  private registerSubscriptions(): void {
    const bindings = this.field.binds ?? [];
    const eventSubscriptions = this.field.eventSubscriptions ?? [];

    if (bindings.length > 0) {
      if (eventSubscriptions.length > 0) {
        console.warn(
          `字段“${this.fieldId}”同时配置了 binds 和 eventSubscriptions；将以 binds 为准。`
        );
      }
      this.unsubscribe = bindings.flatMap(binding => this.registerBinding(binding));
      return;
    }

    this.unsubscribe = eventSubscriptions.map(subscription => {
      return this.eventCenter.subscribe(
        this.normalizeSourceFieldId(subscription.sourceFormKey, subscription.sourceFieldKey),
        subscription.eventName,
        this,
        subscription.handle
      );
    });
  }

  /** 为一个绑定目标注册对应的源事件监听。 */
  private registerBinding(binding: FieldBinding): Array<() => void> {
    const sourceFieldId = this.normalizeSourceFieldId(
      binding.sourceFormKey,
      binding.sourceFieldId
    );
    if (binding.target === 'value') {
      return [
        this.eventCenter.subscribe(sourceFieldId, 'onChange', this, 'change')
      ];
    }

    return [
      this.eventCenter.subscribe(
        sourceFieldId,
        'onChange',
        {
          applyHandle: (_handle, sourceFieldValue, history) => {
            void this.applyStateBinding(binding, sourceFieldValue, history);
          }
        },
        'change'
      )
    ];
  }

  /** 根据绑定源值更新当前字段的可见或启用状态。 */
  private async applyStateBinding(
    binding: FieldBinding,
    sourceFieldValue: unknown,
    history: EventFlowHistory = []
  ): Promise<void> {
    if (binding.target === 'value') return;
    const result = this.resolveBindingBoolean(sourceFieldValue, binding);
    const handle: ComponentHandle = binding.target === 'visible'
      ? result ? 'show' : 'hide'
      : result ? 'enable' : 'disable';
    await this.applyHandle(handle, undefined, history);
  }

  /** 使用当前绑定配置或默认规则将源字段值转换为布尔值。 */
  private resolveBindingBoolean(
    sourceFieldValue: unknown,
    binding: FieldBinding
  ): boolean {
    if (binding.resolver) {
      try {
        const resolver = new Function(
          'sourceFieldValue',
          binding.resolver
        ) as (value: unknown) => unknown;
        return Boolean(resolver(sourceFieldValue));
      } catch (error) {
        console.error(
          `字段“${this.fieldId}”的 ${binding.target} 绑定 resolver 执行失败，将按 false 处理。`,
          error
        );
        return false;
      }
    }
    return this.getDefaultBindingBoolean(sourceFieldValue);
  }

  /** 按默认规则将绑定源字段值转换为布尔值。 */
  private getDefaultBindingBoolean(sourceFieldValue: unknown): boolean {
    if (sourceFieldValue === undefined || sourceFieldValue === null) return false;
    if (typeof sourceFieldValue === 'number') return sourceFieldValue !== 0;
    if (typeof sourceFieldValue === 'string') return sourceFieldValue.length > 0;
    if (typeof sourceFieldValue === 'boolean') return sourceFieldValue;
    return Boolean(sourceFieldValue);
  }

  /** 将字段标识补全为带表单键前缀的完整唯一标识。 */
  private normalizeSourceFieldId(sourceFormKey: string, sourceFieldId: string): string {
    return sourceFieldId.startsWith(`${sourceFormKey}.`)
      ? sourceFieldId
      : `${sourceFormKey}.${sourceFieldId}`;
  }

  /** 创建适合当前字段分类的空值。 */
  private createDefaultValue(): unknown {
    if (Object.prototype.hasOwnProperty.call(this.field, 'defaultValue')) {
      return this.cloneDefaultValue(this.field.defaultValue);
    }
    if (this.field.category === 'array') return [];
    if (this.field.category === 'object') return {};
    return this.field.dataType === 'boolean' ? false : '';
  }

  /** 深复制对象或数组默认值，避免字段实例之间共享可变引用。 */
  private cloneDefaultValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(item => this.cloneDefaultValue(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          this.cloneDefaultValue(item)
        ])
      );
    }
    return value;
  }

  /** 当前字段是否声明了需要准备的组件数据。 */
  private hasComponentDataConfiguration(): boolean {
    return Object.prototype.hasOwnProperty.call(this.field, 'componentData')
      || Boolean(this.field.componentDataKey);
  }

  /** 按字段显式数据、表单级解析器、全局解析器的优先级准备组件数据。 */
  private async prepareComponentData(): Promise<void> {
    this.componentDataAbortController?.abort();
    this.componentDataError = undefined;

    if (this.field.category !== 'basic' || !this.hasComponentDataConfiguration()) {
      this.componentData = undefined;
      this.componentDataLoading = false;
      return;
    }
    if (Object.prototype.hasOwnProperty.call(this.field, 'componentData')) {
      if (this.field.componentDataKey) {
        console.warn(`字段“${this.fieldId}”同时配置了 componentData 和 componentDataKey；将使用 componentData。`);
      }
      this.componentData = this.field.componentData;
      this.componentDataLoading = false;
      return;
    }

    const resolver = this.componentDataResolver ?? getGlobalComponentDataResolver();
    if (!resolver || !this.field.componentDataKey) {
      this.componentData = undefined;
      this.componentDataLoading = false;
      this.componentDataError = new Error(`字段“${this.fieldId}”未找到 componentDataKey 对应的组件数据解析器。`);
      console.error(this.componentDataError);
      return;
    }

    const abortController = new AbortController();
    this.componentDataAbortController = abortController;
    this.componentDataLoading = true;
    try {
      const componentData = await resolver({
        componentDataKey: this.field.componentDataKey,
        field: this.field,
        fieldId: this.fieldId,
        formKey: this.formKey,
        signal: abortController.signal
      });
      if (abortController.signal.aborted) return;
      this.componentData = componentData;
      this.componentDataError = undefined;
    } catch (error) {
      if (abortController.signal.aborted) return;
      this.componentData = undefined;
      this.componentDataError = error instanceof Error
        ? error
        : new Error(String(error));
      console.error(`字段“${this.fieldId}”加载组件数据失败：`, this.componentDataError);
    } finally {
      if (!abortController.signal.aborted) this.componentDataLoading = false;
    }
  }

  /** 未选择已注册组件时渲染原生 HTML 输入控件。 */
  private renderDefaultBasicField() {
    const type = this.field.dataType === 'datetime' ? 'datetime-local' : this.field.dataType === 'string' ? 'text' : this.field.dataType ?? 'text';
    if (this.field.dataType === 'boolean') {
      return <input type="checkbox" checked={Boolean(this.currentValue)} disabled={this.disabled} onChange={this.onInput} />;
    }
    return <input type={type} value={String(this.currentValue ?? '')} disabled={this.disabled} onInput={this.onInput} />;
  }

  /** 保存适配器宿主元素的引用。 */
  private setRendererHost = (host?: HTMLDivElement): void => {
    if (!host && this.rendererHost && this.activeRenderer) {
      this.activeRenderer.unmount(this.rendererHost);
      this.activeRenderer = undefined;
    }
    this.rendererHost = host;
  };

  /** 获取当前字段实际生效的渲染器。 */
  private getActiveRenderer(): BasicFieldRenderer | undefined {
    if (this.basicFieldRenderer === null) return undefined;
    return this.basicFieldRenderer ?? getGlobalBasicFieldRenderer();
  }

  /** 在已注册的框架适配器中渲染或更新基础字段。 */
  private renderWithAdapter(): void {
    const renderer = this.getActiveRenderer();
    if (this.activeRenderer && this.activeRenderer !== renderer && this.rendererHost) {
      this.activeRenderer.unmount(this.rendererHost);
      this.activeRenderer = undefined;
    }
    if (!renderer || !this.rendererHost || this.field.category !== 'basic' || this.componentDataLoading || this.componentDataError) return;

    this.activeRenderer = renderer;
    renderer.render(this.rendererHost, {
      field: this.field,
      fieldId: this.fieldId,
      value: this.currentValue,
      disabled: this.disabled,
      componentData: this.componentData,
      onChange: value => this.updateValue(value, 'onChange')
    });
  }

  /** 渲染已注册自定义组件或原生默认基础字段。 */
  private renderBasicField() {
    if (this.componentDataLoading) return <p class="component-data-status">正在加载组件数据…</p>;
    if (this.componentDataError) return <p class="component-data-status component-data-status--error">组件数据加载失败。</p>;
    if (this.getActiveRenderer()) {
      return <div class="framework-renderer" ref={this.setRendererHost} />;
    }
    const registered = componentRegistry.get(this.field.component);
    if (!registered) return this.renderDefaultBasicField();
    return h(registered.tagName, {
      ...this.field.componentProperties,
      value: this.currentValue,
      componentData: this.componentData,
      disabled: this.disabled,
      onChange: (event: CustomEvent<unknown>) => this.updateValue(event.detail, 'onChange'),
      onValueChange: (event: CustomEvent<unknown>) => this.updateValue(event.detail, 'onChange')
    });
  }

  /** 按配置字段分类渲染内部编辑器。 */
  private renderEditor() {
    if (this.field.category === 'array') {
      return (
        <form-easy-array
          field={this.field}
          fieldId={this.fieldId}
          formKey={this.formKey}
          labelPosition={this.labelPosition}
          basicFieldRenderer={this.basicFieldRenderer}
          componentDataResolver={this.componentDataResolver}
          value={this.currentValue}
          eventCenter={this.eventCenter}
          disabled={this.disabled}
          onValueChange={this.onNestedValueChange}
        />
      );
    }
    if (this.field.category === 'object') {
      return (
        <form-easy-object
          fields={this.field.fields ?? []}
          fieldId={this.fieldId}
          formKey={this.formKey}
          labelPosition={this.labelPosition}
          basicFieldRenderer={this.basicFieldRenderer}
          componentDataResolver={this.componentDataResolver}
          value={this.currentValue}
          eventCenter={this.eventCenter}
          disabled={this.disabled}
          onValueChange={this.onNestedValueChange}
        />
      );
    }
    return this.renderBasicField();
  }

  /** 渲染字段名称和编辑器。 */
  render() {
    if (!this.visible) return null;
    return (
      <section class={`field field--${this.labelPosition}`} part="field">
        <label>
          {this.field.name}
          {this.field.required && <span class="required"> *</span>}
        </label>
        {this.field.hint && <small>{this.field.hint}</small>}
        <div class="editor">{this.renderEditor()}</div>
      </section>
    );
  }
}
