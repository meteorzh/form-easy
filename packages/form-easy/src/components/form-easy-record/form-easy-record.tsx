import {
  Component,
  Event,
  EventEmitter,
  h,
  Method,
  Prop,
  State,
  Watch
} from '@stencil/core';
import type { FormFieldDefinitions } from '../../form-field-definition-resolver';
import { resolveFormFieldNode } from '../../form-field-definition-resolver';
import type { ComponentDataManager } from '../../managers/component-data-manager';
import type { EndpointManager } from '../../managers/endpoint-manager';
import { globalEventCenter, type EventCenter } from '../../managers/event-center';
import {
  synchronizeFormFieldValue,
  type FormValueStore
} from '../../managers/form-value-store';
import type { BasicFieldRenderer } from '../../renderers/basic-field-renderer';
import type { FormField, LabelPosition } from '../../types';

/** record 编辑器内部维护的稳定键值条目。 */
interface FormRecordEntry {
  /** 不随用户修改 key 变化的内部标识。 */
  id: number;
  /** 用户输入的动态对象属性名。 */
  key: string;
  /** 当前动态属性对应的字段值。 */
  value: unknown;
}

/** 不允许作为动态对象属性名的高风险键。 */
const unsafeRecordKeys = new Set(['__proto__', 'constructor', 'prototype']);

/** 编辑键由用户输入、值结构由 kvDef 统一声明的动态 record 字段。 */
@Component({
  tag: 'form-easy-record',
  styleUrl: 'form-easy-record.css'
})
export class FormEasyRecord {
  /** record 字段定义。 */
  @Prop() field!: FormField;
  /** record 字段的完整唯一标识。 */
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
  /** 当前 record 值。 */
  @Prop() value: unknown;
  /** 当前表单共享的事件中心。 */
  @Prop() eventCenter: EventCenter = globalEventCenter;
  /** 当前表单共享的字段值存储。 */
  @Prop() formValueStore?: FormValueStore;
  /** 当前表单可通过 $ref 使用的字段定义。 */
  @Prop() fieldDefinitions: FormFieldDefinitions = {};
  /** 当前 record 字段所在的渲染深度。 */
  @Prop() renderDepth = 0;
  /** 表单允许渲染的最大嵌套深度。 */
  @Prop() maxRenderDepth = 32;
  /** 是否禁止修改 record 条目。 */
  @Prop() disabled = false;
  /** record 产生合法对象值后向父级发送变化。 */
  @Event() valueChange!: EventEmitter<Record<string, unknown>>;

  /** 按稳定内部标识维护的键值条目。 */
  @State() private entries: FormRecordEntry[] = [];
  /** record 是否已经从 null 状态创建。 */
  @State() private initialized = false;
  /** record 内容是否处于展开状态。 */
  @State() private expanded = true;
  /** 下一个键值条目使用的内部标识。 */
  private nextEntryId = 0;
  /** 最近一次向父级发送的对象，用于忽略值事件回写。 */
  private lastEmittedValue?: Record<string, unknown>;
  /** 外部值同步后是否需要发布条目初始化事件。 */
  private shouldPublishInitialValues = false;

  /** 根据初始对象值创建稳定的本地条目。 */
  componentWillLoad(): void {
    this.loadExternalValue(this.value);
  }

  /** 首次挂载全部键值编辑器后发布初始化事件。 */
  componentDidLoad(): void {
    this.publishInitialValues();
  }

  /** 外部值重建条目后，在渲染完成阶段发布初始化事件。 */
  componentDidRender(): void {
    if (!this.shouldPublishInitialValues) return;
    this.shouldPublishInitialValues = false;
    this.synchronizeStoredValue();
    this.publishInitialValues();
  }

  /** 同步绑定、预设值或父级回写的 record 值。 */
  @Watch('value')
  syncExternalValue(newValue: unknown): void {
    if (newValue === this.lastEmittedValue) {
      this.lastEmittedValue = undefined;
      return;
    }
    this.loadExternalValue(newValue);
    this.shouldPublishInitialValues = true;
  }

  /** 校验所有动态 key 是否非空、唯一且安全。 */
  @Method()
  async validateEntries(): Promise<boolean> {
    return this.entries.every((_, index) => !this.getKeyError(index));
  }

  /** 添加一个使用 kvDef 默认配置的新条目。 */
  private addEntry = (): void => {
    if (this.disabled) return;
    if (!this.initialized) {
      this.initialized = true;
      this.emitValue({});
    }
    const entry: FormRecordEntry = {
      id: this.nextEntryId++,
      key: this.createDefaultKey(),
      value: this.createDefaultValue()
    };
    this.entries = [...this.entries, entry];
    this.expanded = true;
    this.shouldPublishInitialValues = true;
    this.emitCurrentValueIfValid();
  };

  /** 删除指定内部标识对应的键值条目。 */
  private removeEntry = (entryId: number): void => {
    this.entries = this.entries.filter(entry => entry.id !== entryId);
    this.shouldPublishInitialValues = true;
    this.emitCurrentValueIfValid();
  };

  /** 更新一个动态属性名，并在全部 key 合法时同步对象值。 */
  private changeEntryKey = (
    entryId: number,
    event: CustomEvent<unknown>
  ): void => {
    event.stopPropagation();
    const key = typeof event.detail === 'string'
      ? event.detail
      : String(event.detail ?? '');
    this.entries = this.entries.map(entry =>
      entry.id === entryId ? { ...entry, key } : entry
    );
    this.emitCurrentValueIfValid();
  };

  /** 更新一个动态属性值，并在全部 key 合法时同步对象值。 */
  private changeEntryValue = (
    entryId: number,
    event: CustomEvent<unknown>
  ): void => {
    event.stopPropagation();
    this.entries = this.entries.map(entry =>
      entry.id === entryId ? { ...entry, value: event.detail } : entry
    );
    this.emitCurrentValueIfValid();
  };

  /** 切换 record 条目列表的展开状态。 */
  private toggleExpanded = (): void => {
    this.expanded = !this.expanded;
  };

  /** 将外部普通对象转换为本地键值条目。 */
  private loadExternalValue(value: unknown): void {
    if (!this.isRecordValue(value)) {
      this.initialized = false;
      this.entries = [];
      return;
    }
    this.initialized = true;
    this.entries = Object.entries(value).map(([key, item]) => ({
      id: this.nextEntryId++,
      key,
      value: item
    }));
  }

  /** 在全部 key 合法时构造并发送最新 record 对象。 */
  private emitCurrentValueIfValid(): void {
    const value = this.createRecordValue();
    if (!value) return;
    this.emitValue(value);
  }

  /** 发送对象值并保存引用，避免父级回写导致输入控件重建。 */
  private emitValue(value: Record<string, unknown>): void {
    this.lastEmittedValue = value;
    this.valueChange.emit(value);
  }

  /**
   * 条目删除导致后续索引迁移后，重新写入整个 record 分支，避免不同子组件
   * 更新顺序令字段值存储短暂保留旧索引。
   */
  private synchronizeStoredValue(): void {
    const value = this.createRecordValue();
    if (!value || !this.formValueStore) return;
    synchronizeFormFieldValue(
      this.formValueStore,
      this.field,
      this.fieldId,
      value,
      this.fieldDefinitions,
      this.maxRenderDepth
    );
  }

  /** 将当前条目安全转换为普通对象；存在无效 key 时返回 undefined。 */
  private createRecordValue(): Record<string, unknown> | undefined {
    if (!this.initialized) return undefined;
    if (this.entries.some((_, index) => this.getKeyError(index))) {
      return undefined;
    }
    const value: Record<string, unknown> = {};
    this.entries.forEach(entry => {
      Object.defineProperty(value, entry.key, {
        configurable: true,
        enumerable: true,
        value: entry.value,
        writable: true
      });
    });
    return value;
  }

  /** 返回指定条目的动态 key 错误提示。 */
  private getKeyError(index: number): string | undefined {
    const key = this.entries[index]?.key ?? '';
    if (!key.trim()) return '属性名不能为空。';
    if (unsafeRecordKeys.has(key)) return `属性名“${key}”不安全，请使用其他名称。`;
    const duplicate = this.entries.some((entry, entryIndex) =>
      entryIndex !== index && entry.key === key
    );
    return duplicate ? `属性名“${key}”已经存在。` : undefined;
  }

  /** 获取固定为 string 类型且必填的动态 key 字段配置。 */
  private get keyField(): FormField {
    return {
      ...(this.field.kvDef?.key ?? {}),
      name: this.field.kvDef?.key.name ?? '属性名',
      category: 'basic',
      dataType: 'string',
      required: true
    };
  }

  /** 获取当前 record 每个动态属性共用的 value 字段配置。 */
  private get valueField(): FormField | undefined {
    const valueNode = this.field.kvDef?.value;
    if (!valueNode) return undefined;
    const field = resolveFormFieldNode(valueNode, this.fieldDefinitions);
    return field
      ? { ...field, name: field.name ?? '属性值' }
      : undefined;
  }

  /** 创建新条目使用的默认字符串 key。 */
  private createDefaultKey(): string {
    const defaultValue = this.field.kvDef?.key.defaultValue;
    return typeof defaultValue === 'string' ? defaultValue : '';
  }

  /** 根据 value 定义创建新条目的默认值。 */
  private createDefaultValue(): unknown {
    const field = this.valueField;
    if (!field) return null;
    if (Object.prototype.hasOwnProperty.call(field, 'defaultValue')) {
      return this.cloneValue(field.defaultValue);
    }
    return null;
  }

  /** 深复制 JSON 默认值，避免不同条目共享可变数据。 */
  private cloneValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(item => this.cloneValue(item));
    if (this.isRecordValue(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.cloneValue(item)])
      );
    }
    return value;
  }

  /** 为每一个已挂载的动态 key 和 value 发布初始化事件。 */
  private publishInitialValues(): void {
    this.entries.forEach((entry, index) => {
      this.eventCenter.publish(`${this.fieldId}[${index}].key`, 'onChange', entry.key);
      this.eventCenter.publish(
        `${this.fieldId}[${index}].value`,
        'onChange',
        entry.value
      );
    });
  }

  /** 判断未知值是否为 record 可以编辑的普通对象。 */
  private isRecordValue(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  /** 渲染单个动态键值条目。 */
  private renderEntry(entry: FormRecordEntry, index: number, valueField: FormField) {
    const keyError = this.getKeyError(index);
    return (
      <section class="record-entry" key={entry.id}>
        <div class="record-entry-fields">
          <div class="record-entry-key">
            <form-easy-field
              field={this.keyField}
              fieldId={`${this.fieldId}[${index}].key`}
              formKey={this.formKey}
              labelPosition="top"
              basicFieldRenderer={this.basicFieldRenderer}
              componentDataManager={this.componentDataManager}
              endpointManager={this.endpointManager}
              value={entry.key}
              eventCenter={this.eventCenter}
              formValueStore={this.formValueStore}
              fieldDefinitions={this.fieldDefinitions}
              renderDepth={this.renderDepth + 1}
              maxRenderDepth={this.maxRenderDepth}
              parentDisabled={this.disabled}
              onValueChange={(event: CustomEvent<unknown>) =>
                this.changeEntryKey(entry.id, event)
              }
            />
            {keyError && <p class="record-key-error" role="alert">{keyError}</p>}
          </div>
          <div class="record-entry-value">
            <form-easy-field
              field={valueField}
              fieldId={`${this.fieldId}[${index}].value`}
              formKey={this.formKey}
              labelPosition={this.labelPosition}
              basicFieldRenderer={this.basicFieldRenderer}
              componentDataManager={this.componentDataManager}
              endpointManager={this.endpointManager}
              value={entry.value}
              eventCenter={this.eventCenter}
              formValueStore={this.formValueStore}
              fieldDefinitions={this.fieldDefinitions}
              renderDepth={this.renderDepth + 1}
              maxRenderDepth={this.maxRenderDepth}
              parentDisabled={this.disabled}
              onValueChange={(event: CustomEvent<unknown>) =>
                this.changeEntryValue(entry.id, event)
              }
            />
          </div>
        </div>
        <button
          class="record-remove"
          type="button"
          disabled={this.disabled}
          aria-label={`删除第 ${index + 1} 个键值项`}
          title={`删除第 ${index + 1} 个键值项`}
          onClick={() => this.removeEntry(entry.id)}
        >
          删除
        </button>
      </section>
    );
  }

  /** 渲染 record 工具栏、空状态和全部动态键值条目。 */
  render() {
    if (!this.field.kvDef) return <p class="record-error">record 字段缺少 kvDef。</p>;
    const valueField = this.valueField;
    if (!valueField) return <p class="record-error">record 的 value 定义无法解析。</p>;

    return (
      <div class="record" part="record">
        <div class="record-toolbar">
          <button
            class="record-toggle"
            type="button"
            aria-expanded={String(this.expanded)}
            onClick={this.toggleExpanded}
          >
            <svg
              class={{ 'record-toggle-icon': true, 'is-expanded': this.expanded }}
              aria-hidden="true"
              viewBox="0 0 20 20"
            >
              <path d="m7 5 5 5-5 5" />
            </svg>
            共 {this.entries.length} 项
          </button>
          <button
            class="record-add"
            type="button"
            disabled={this.disabled}
            aria-label="添加一个键值项"
            onClick={this.addEntry}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20">
              <path d="M10 4v12M4 10h12" />
            </svg>
            添加键值项
          </button>
        </div>
        <div class="record-content" hidden={!this.expanded}>
          {this.entries.length === 0 ? (
            <button
              class="record-empty"
              type="button"
              disabled={this.disabled}
              aria-label="添加第一个键值项"
              onClick={this.addEntry}
            >
              暂无键值项，点击添加第一项
            </button>
          ) : (
            <div class="record-entries">
              {this.entries.map((entry, index) =>
                this.renderEntry(entry, index, valueField)
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}
