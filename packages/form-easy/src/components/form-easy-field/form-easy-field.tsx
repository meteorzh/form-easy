import { Component, Event, EventEmitter, h, Method, Prop, State, Watch } from '@stencil/core';
import {
  parseComponentDataExpression,
  type ComponentDataExpression
} from '../../component-data-expression';
import {
  isRelativeFieldReference,
  isSiblingFieldReference,
  resolveRelativeFieldId,
  resolveSiblingFieldId
} from '../../field-reference';
import {
  getGlobalComponentDataManager,
  type ComponentDataManager
} from '../../managers/component-data-manager';
import {
  getGlobalEndpointManager,
  type EndpointManager
} from '../../managers/endpoint-manager';
import { globalEventCenter, type EventCenter } from '../../managers/event-center';
import {
  synchronizeFormFieldValue,
  type FormValueStore
} from '../../managers/form-value-store';
import {
  getGlobalBasicFieldRenderer,
  type BasicFieldRenderer
} from '../../renderers/basic-field-renderer';
import { defaultH5BasicFieldRenderer } from '../../renderers/h5-basic-field-renderer';
import { validateFieldValue } from '../../validation/field-validator';
import type {
  ComponentDataResolverParams,
  ComponentEventName,
  ComponentHandle,
  EventFlowHistory,
  FieldBinding,
  FieldValidationErrorType,
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
  /** 父级对象或数组字段是否处于禁用状态。 */
  @Prop() parentDisabled = false;
  /**
   * 当前字段所属表单指定的基础字段渲染器。
   * undefined 使用全局渲染器，null 强制使用默认 H5 渲染。
   */
  @Prop() basicFieldRenderer?: BasicFieldRenderer | null;
  /** 当前表单覆盖全局配置的组件数据管理器。 */
  @Prop() componentDataManager?: ComponentDataManager;
  /** 当前表单覆盖全局配置的异步服务端点管理器。 */
  @Prop() endpointManager?: EndpointManager;
  /** 表单内所有字段共用的事件路由器。 */
  @Prop() eventCenter: EventCenter = globalEventCenter;
  /** 当前表单共享的字段值存储。 */
  @Prop() formValueStore?: FormValueStore;
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
  /** 当前字段首个未通过规则的错误信息。 */
  @State() private validationError?: string;
  /** 当前字段校验错误来自用户值还是 schema 配置。 */
  @State() private validationErrorType?: FieldValidationErrorType;
  /** 最近一次已经输出到控制台的规则配置错误。 */
  private lastLoggedValidationConfigurationError?: string;
  /** 是否已经允许向用户展示普通字段值校验错误。 */
  private validationFeedbackActive = false;
  /** 已注册事件订阅的清理回调。 */
  private unsubscribe: Array<() => void> = [];
  /** 供框架渲染适配器挂载视图的稳定宿主元素。 */
  private rendererHost?: HTMLDivElement;
  /** 上一次实际用于渲染的适配器，用于切换时正确卸载。 */
  private activeRenderer?: BasicFieldRenderer;
  /** 用于取消已过期组件数据请求的控制器。 */
  private componentDataAbortController?: AbortController;
  /** 当前 componentDataKey 解析后的调用表达式。 */
  private componentDataExpression?: ComponentDataExpression;
  /** 已从参数源事件中收集的组件数据解析参数。 */
  private componentDataResolverParams: ComponentDataResolverParams = {};
  /** 已经收到初始化值的动态参数名。 */
  private readonly readyComponentDataParameterNames = new Set<string>();
  /** 组件数据动态参数事件订阅的清理函数。 */
  private componentDataParameterUnsubscribe: Array<() => void> = [];

  /** 初始化本地字段值和事件订阅。 */
  componentWillLoad(): void {
    this.currentValue = this.value ?? null;
    this.validateCurrentValue();
    this.registerSubscriptions();
    this.configureComponentData();
  }

  /** 将根表单传入的新字段值同步到当前字段。 */
  @Watch('value')
  syncExternalValue(newValue: unknown): void {
    this.currentValue = newValue ?? null;
    this.synchronizeStoredValue(this.currentValue);
    this.validateCurrentValue();
  }

  /** 字段配置更新后重新解析组件数据。 */
  @Watch('field')
  reloadComponentData(): void {
    this.validateCurrentValue();
    this.configureComponentData();
  }

  /** 父级禁用状态变化后重新计算当前字段的校验结果。 */
  @Watch('parentDisabled')
  validateParentDisabledState(): void {
    this.validateCurrentValue();
  }

  /** 表单级组件数据管理器更新后重新加载组件数据。 */
  @Watch('componentDataManager')
  reloadComponentDataManager(): void {
    void this.prepareComponentData();
  }

  /** 表单字段值存储变化后迁移当前值并重新建立参数订阅。 */
  @Watch('formValueStore')
  reloadFormValueStore(
    newStore?: FormValueStore,
    oldStore?: FormValueStore
  ): void {
    oldStore?.deleteBranch(this.fieldId);
    if (newStore) {
      synchronizeFormFieldValue(
        newStore,
        this.field,
        this.fieldId,
        this.currentValue
      );
    }
    this.configureComponentData();
  }

  /** 当前字段被移除时释放事件订阅。 */
  disconnectedCallback(): void {
    this.unsubscribe.forEach(cleanup => cleanup());
    this.unsubscribe = [];
    this.clearComponentDataParameterSubscriptions();
    this.componentDataAbortController?.abort();
    this.formValueStore?.deleteBranch(this.fieldId);
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
    this.validateCurrentValue();
  }

  /** 执行当前字段的同步规则校验，并更新错误展示状态。 */
  @Method()
  async validate(): Promise<boolean> {
    this.validationFeedbackActive = true;
    return this.validateCurrentValue();
  }

  /** 字段失焦后开始展示普通值校验错误。 */
  private activateValidationFeedback = (): void => {
    this.validationFeedbackActive = true;
    this.validateCurrentValue();
  };

  /** 处理嵌套对象或数组字段触发的值。 */
  private onNestedValueChange = (event: CustomEvent<unknown>): void => {
    event.stopPropagation();
    this.updateValue(event.detail, 'onChange');
  };

  /** 更新本地状态、冒泡值事件并路由配置的事件。 */
  private updateValue(
    value: unknown,
    eventName: ComponentEventName,
    history: EventFlowHistory = []
  ): void {
    this.currentValue = value;
    this.synchronizeStoredValue(value);
    this.validateCurrentValue();
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

  /** 将当前字段及其嵌套后代值同步到表单字段值存储。 */
  private synchronizeStoredValue(value: unknown): void {
    if (!this.formValueStore) return;
    synchronizeFormFieldValue(
      this.formValueStore,
      this.field,
      this.fieldId,
      value
    );
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
    const sourceFieldId = this.resolveBindingSourceFieldId(binding);
    if (!sourceFieldId) return [];
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

  /** 将绑定配置中的完整或同级引用解析为运行时字段标识。 */
  private resolveBindingSourceFieldId(binding: FieldBinding): string | undefined {
    if (!isSiblingFieldReference(binding.sourceFieldId)) {
      return this.normalizeSourceFieldId(binding.sourceFormKey, binding.sourceFieldId);
    }
    if (binding.sourceFormKey !== this.formKey) {
      console.error(
        `字段“${this.fieldId}”的同级绑定只能引用当前表单“${this.formKey}”。`
      );
      return undefined;
    }
    const sourceFieldId = resolveSiblingFieldId(this.fieldId, binding.sourceFieldId);
    if (!sourceFieldId) {
      console.error(
        `字段“${this.fieldId}”的同级绑定源“${binding.sourceFieldId}”格式无效。`
      );
    }
    return sourceFieldId;
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
    if (this.field.category === 'object') return null;
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

  /** 返回当前字段及其父级合并后的实际禁用状态。 */
  private get effectiveDisabled(): boolean {
    return this.disabled || this.parentDisabled;
  }

  /** 校验当前字段值；配置错误立即展示，值错误按交互状态展示。 */
  private validateCurrentValue(): boolean {
    if (!this.visible || this.effectiveDisabled) {
      this.validationError = undefined;
      this.validationErrorType = undefined;
      this.lastLoggedValidationConfigurationError = undefined;
      return true;
    }
    const result = validateFieldValue(this.field, this.currentValue);
    const shouldDisplayError = result.errorType === 'configuration'
      || this.validationFeedbackActive;
    this.validationError = shouldDisplayError ? result.message : undefined;
    this.validationErrorType = result.errorType;
    if (
      result.errorType === 'configuration'
      && result.message
      && result.message !== this.lastLoggedValidationConfigurationError
    ) {
      console.error(new Error(result.message));
      this.lastLoggedValidationConfigurationError = result.message;
    }
    if (result.errorType !== 'configuration') {
      this.lastLoggedValidationConfigurationError = undefined;
    }
    return result.valid;
  }

  /** 当前字段是否声明了需要准备的组件数据。 */
  private hasComponentDataConfiguration(): boolean {
    return Object.prototype.hasOwnProperty.call(this.field, 'componentData')
      || Boolean(this.field.componentDataKey);
  }

  /** 解析组件数据调用表达式，并为每一个动态参数注册值订阅。 */
  private configureComponentData(): void {
    this.clearComponentDataParameterSubscriptions();
    this.componentDataAbortController?.abort();
    this.componentDataExpression = undefined;
    this.componentDataResolverParams = {};
    this.readyComponentDataParameterNames.clear();

    if (
      this.field.category !== 'basic'
      || !this.field.componentDataKey
      || Object.prototype.hasOwnProperty.call(this.field, 'componentData')
    ) {
      void this.prepareComponentData();
      return;
    }

    try {
      this.componentDataExpression = parseComponentDataExpression(
        this.field.componentDataKey
      );
    } catch (error) {
      this.setComponentDataConfigurationError(error);
      return;
    }

    const parameters = this.componentDataExpression.parameters;
    if (parameters.length === 0) {
      void this.prepareComponentData();
      return;
    }

    this.componentData = undefined;
    this.componentDataLoading = true;
    this.componentDataError = undefined;
    for (const parameter of parameters) {
      const sourceFieldId = this.resolveComponentDataParameterFieldId(
        parameter.fieldReference
      );
      if (!sourceFieldId) {
        this.clearComponentDataParameterSubscriptions();
        this.setComponentDataConfigurationError(
          new Error(
            `参数“${parameter.name}”的字段引用“${parameter.fieldReference}”无效。`
          )
        );
        return;
      }
      if (!this.formValueStore) {
        this.clearComponentDataParameterSubscriptions();
        this.setComponentDataConfigurationError(
          new Error('当前字段未连接到表单字段值存储。')
        );
        return;
      }
      this.componentDataParameterUnsubscribe.push(
        this.formValueStore.subscribe(
          sourceFieldId,
          value => this.updateComponentDataParameter(parameter.name, value),
          true
        )
      );
    }
  }

  /** 将动态参数字段引用转换为实际运行时字段标识。 */
  private resolveComponentDataParameterFieldId(fieldReference: string): string | undefined {
    if (isRelativeFieldReference(fieldReference)) {
      return resolveRelativeFieldId(this.fieldId, fieldReference);
    }
    return fieldReference.includes('.') ? fieldReference : undefined;
  }

  /** 接收参数源最新值，并在全部参数就绪后重新加载组件数据。 */
  private updateComponentDataParameter(name: string, value: unknown): void {
    this.componentDataResolverParams = {
      ...this.componentDataResolverParams,
      [name]: value
    };
    this.readyComponentDataParameterNames.add(name);
    if (
      this.readyComponentDataParameterNames.size
      === this.componentDataExpression?.parameters.length
    ) {
      void this.prepareComponentData();
    }
  }

  /** 记录组件数据表达式配置错误并停止实际组件渲染。 */
  private setComponentDataConfigurationError(error: unknown): void {
    this.componentDataAbortController?.abort();
    this.componentData = undefined;
    this.componentDataLoading = false;
    this.componentDataError = error instanceof Error ? error : new Error(String(error));
    console.error(
      `字段“${this.fieldId}”的 componentDataKey 配置无效：`,
      this.componentDataError
    );
  }

  /** 清理当前字段的全部组件数据参数订阅。 */
  private clearComponentDataParameterSubscriptions(): void {
    this.componentDataParameterUnsubscribe.forEach(cleanup => cleanup());
    this.componentDataParameterUnsubscribe = [];
  }

  /** 按字段显式数据、表单级管理器、全局管理器的优先级准备组件数据。 */
  private async prepareComponentData(): Promise<void> {
    this.componentDataAbortController?.abort();
    this.componentDataError = undefined;

    if (
      this.componentDataExpression
      && this.readyComponentDataParameterNames.size
        < this.componentDataExpression.parameters.length
    ) {
      this.componentData = undefined;
      this.componentDataLoading = true;
      return;
    }

    if (this.field.category !== 'basic' || !this.hasComponentDataConfiguration()) {
      this.componentData = undefined;
      this.componentDataLoading = false;
      return;
    }
    if (Object.prototype.hasOwnProperty.call(this.field, 'componentData')) {
      if (this.field.componentDataKey) {
        console.warn(
          `字段“${this.fieldId}”同时配置了 componentData 和 componentDataKey；`
          + '将使用 componentData。'
        );
      }
      this.componentData = this.field.componentData;
      this.componentDataLoading = false;
      return;
    }

    const componentDataManager = this.componentDataManager ?? getGlobalComponentDataManager();
    const componentDataKey = this.componentDataExpression?.key;
    if (!componentDataManager || !componentDataKey) {
      this.componentData = undefined;
      this.componentDataLoading = false;
      this.componentDataError = new Error(
        `字段“${this.fieldId}”未找到 componentDataKey 对应的组件数据管理器。`
      );
      console.error(this.componentDataError);
      return;
    }

    const abortController = new AbortController();
    this.componentDataAbortController = abortController;
    this.componentDataLoading = true;
    try {
      const componentData = await componentDataManager.resolve(componentDataKey, {
        field: this.field,
        fieldId: this.fieldId,
        formKey: this.formKey,
        signal: abortController.signal
      }, this.componentDataResolverParams);
      if (abortController.signal.aborted) return;
      this.synchronizeCurrentValueFromStore();
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

  /** 在组件数据就绪后读取字段存储，确保渲染器接收最新字段值。 */
  private synchronizeCurrentValueFromStore(): void {
    if (!this.formValueStore?.hasValue(this.fieldId)) return;
    this.currentValue = this.formValueStore.getValue(this.fieldId);
    this.validateCurrentValue();
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
  private getActiveRenderer(): BasicFieldRenderer {
    if (this.basicFieldRenderer === null) return defaultH5BasicFieldRenderer;
    return this.basicFieldRenderer
      ?? getGlobalBasicFieldRenderer()
      ?? defaultH5BasicFieldRenderer;
  }

  /** 在当前生效的基础字段渲染器中渲染或更新字段。 */
  private renderWithAdapter(): void {
    const renderer = this.getActiveRenderer();
    if (this.activeRenderer && this.activeRenderer !== renderer && this.rendererHost) {
      this.activeRenderer.unmount(this.rendererHost);
      this.activeRenderer = undefined;
    }
    if (!this.rendererHost || this.field.category !== 'basic' || this.componentDataLoading || this.componentDataError) return;

    this.activeRenderer = renderer;
    renderer.render(this.rendererHost, {
      field: this.field,
      fieldId: this.fieldId,
      value: this.currentValue,
      disabled: this.effectiveDisabled,
      componentData: this.componentData,
      endpointManager: this.endpointManager ?? getGlobalEndpointManager(),
      formKey: this.formKey,
      onChange: value => this.updateValue(value, 'onChange')
    });
  }

  /** 渲染基础字段的数据加载状态和稳定渲染宿主。 */
  private renderBasicField() {
    if (this.componentDataLoading) return <p class="component-data-status">正在加载组件数据…</p>;
    if (this.componentDataError) return <p class="component-data-status component-data-status--error">组件数据加载失败。</p>;
    return <div class="framework-renderer" ref={this.setRendererHost} />;
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
          componentDataManager={this.componentDataManager}
          endpointManager={this.endpointManager}
          value={this.currentValue}
          eventCenter={this.eventCenter}
          formValueStore={this.formValueStore}
          disabled={this.effectiveDisabled}
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
          componentDataManager={this.componentDataManager}
          endpointManager={this.endpointManager}
          value={this.currentValue}
          eventCenter={this.eventCenter}
          formValueStore={this.formValueStore}
          disabled={this.effectiveDisabled}
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
        <div class="editor" onFocusout={this.activateValidationFeedback}>
          {this.renderEditor()}
          {this.validationError && (
            <p
              class={{
                'validation-error': true,
                'validation-error--configuration': this.validationErrorType === 'configuration'
              }}
              role="alert"
            >
              {this.validationError}
            </p>
          )}
        </div>
      </section>
    );
  }
}
