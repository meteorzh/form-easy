import { Component, Event, EventEmitter, h, Prop, State, Watch } from '@stencil/core';
import { globalEventCenter, type EventCenter } from '../../managers/event-center';
import type { ComponentDataManager } from '../../managers/component-data-manager';
import type { EndpointManager } from '../../managers/endpoint-manager';
import type { FormValueStore } from '../../managers/form-value-store';
import type { BasicFieldRenderer } from '../../renderers/basic-field-renderer';
import type { FormField, LabelPosition } from '../../types';

/** 将对象字段渲染为不含独立表单键和名称的嵌套表单。 */
@Component({ tag: 'form-easy-object', styleUrl: 'form-easy-object.css' })
export class FormEasyObject {
  /** 子字段定义列表。 */
  @Prop() fields: FormField[] = [];
  /** 当前对象字段的标识前缀。 */
  @Prop() fieldId!: string;
  /** 所属表单的键。 */
  @Prop() formKey!: string;
  /** 字段标签相对于编辑器的位置。 */
  @Prop() labelPosition: LabelPosition = 'left';
  /** 当前表单指定的基础字段渲染器。 */
  @Prop() basicFieldRenderer?: BasicFieldRenderer | null;
  /** 当前表单覆盖全局配置的组件数据管理器。 */
  @Prop() componentDataManager?: ComponentDataManager;
  /** 当前表单覆盖全局配置的异步服务端点管理器。 */
  @Prop() endpointManager?: EndpointManager;
  /** 当前对象值。 */
  @Prop() value: unknown;
  /** 共享事件路由器。 */
  @Prop() eventCenter: EventCenter = globalEventCenter;
  /** 当前表单共享的字段值存储。 */
  @Prop() formValueStore?: FormValueStore;
  /** 是否禁用嵌套字段编辑。 */
  @Prop() disabled = false;
  /** 子字段变更后触发完整的嵌套对象。 */
  @Event() valueChange!: EventEmitter<Record<string, unknown>>;
  /** 本地维护的嵌套对象；null 表示对象尚未创建。 */
  @State() private objectValue: Record<string, unknown> | null = null;
  /** 标记对象在本轮渲染完成后是否需要发布子字段初始化事件。 */
  private shouldPublishInitialFieldValues = false;

  /** 初始化本地对象值。 */
  componentWillLoad(): void {
    this.objectValue = this.normalizeObjectValue(this.value);
  }

  /** 全部初始子字段挂载后发布当前值，确保同级绑定完成首屏同步。 */
  componentDidLoad(): void {
    this.publishInitialFieldValues();
  }

  /** 延迟到新增子字段完成挂载后发布其初始化值。 */
  componentDidRender(): void {
    if (!this.shouldPublishInitialFieldValues) return;
    this.shouldPublishInitialFieldValues = false;
    this.publishInitialFieldValues();
  }

  /** 外部值变化后同步本地对象；undefined 按 null 处理。 */
  @Watch('value')
  syncExternalValue(newValue: unknown): void {
    this.objectValue = this.normalizeObjectValue(newValue);
    this.shouldPublishInitialFieldValues = this.objectValue !== null;
  }

  /** 点击占位按钮后，使用子字段默认值创建对象。 */
  private initializeObject = (): void => {
    if (this.disabled) return;
    const initialValue = Object.fromEntries(
      this.fields
        .filter(field => field.key)
        .map(field => [field.key!, this.createFieldInitialValue(field)])
    );
    this.objectValue = initialValue;
    this.shouldPublishInitialFieldValues = true;
    this.valueChange.emit(initialValue);
  }

  /** 为当前对象的直接子字段发布 onChange 初始化事件。 */
  private publishInitialFieldValues(): void {
    if (!this.objectValue) return;
    this.fields.forEach(field => {
      if (!field.key) return;
      this.eventCenter.publish(
        `${this.fieldId}.${field.key}`,
        'onChange',
        this.objectValue?.[field.key] ?? null
      );
    });
  }

  /** 根据 schema 键更新嵌套子字段。 */
  private changeField = (key: string, event: CustomEvent<unknown>): void => {
    event.stopPropagation();
    this.objectValue = { ...(this.objectValue ?? {}), [key]: event.detail };
    this.valueChange.emit(this.objectValue);
  };

  /** 将传入值规范化为可编辑对象或未创建状态。 */
  private normalizeObjectValue(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : null;
  }

  /** 获取对象创建时单个子字段的初始值。 */
  private createFieldInitialValue(field: FormField): unknown {
    return Object.prototype.hasOwnProperty.call(field, 'defaultValue')
      ? this.cloneValue(field.defaultValue)
      : null;
  }

  /** 深复制默认值，避免不同对象实例共享可变数据。 */
  private cloneValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(item => this.cloneValue(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          this.cloneValue(item)
        ])
      );
    }
    return value;
  }

  /** 渲染尚未创建对象时使用的编辑按钮。 */
  private renderPlaceholder() {
    const label = '创建并编辑对象';
    return (
      <button
        class="object-placeholder"
        type="button"
        disabled={this.disabled}
        title={label}
        aria-label={label}
        onClick={this.initializeObject}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
        </svg>
      </button>
    );
  }

  /** 渲染嵌套对象中的全部字段。 */
  render() {
    if (this.objectValue === null) return this.renderPlaceholder();
    const objectValue = this.objectValue;

    return (
      <div class="object" part="object">
        {this.fields.map(field => field.key ? (
          <form-easy-field
            field={field}
            fieldId={`${this.fieldId}.${field.key}`}
            formKey={this.formKey}
            labelPosition={this.labelPosition}
            basicFieldRenderer={this.basicFieldRenderer}
            componentDataManager={this.componentDataManager}
            endpointManager={this.endpointManager}
            value={objectValue[field.key]}
            eventCenter={this.eventCenter}
            formValueStore={this.formValueStore}
            parentDisabled={this.disabled}
            onValueChange={(event: CustomEvent<unknown>) => this.changeField(field.key!, event)}
          />
        ) : null)}
      </div>
    );
  }
}
