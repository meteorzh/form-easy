import { Component, Event, EventEmitter, h, Prop, State, Watch } from '@stencil/core';
import { globalEventCenter, type EventCenter } from '../../managers/event-center';
import type { ComponentDataManager } from '../../managers/component-data-manager';
import type { EndpointManager } from '../../managers/endpoint-manager';
import type { FormValueStore } from '../../managers/form-value-store';
import type { BasicFieldRenderer } from '../../renderers/basic-field-renderer';
import type { FormField, LabelPosition } from '../../types';

/** 为数组字段提供添加和删除编辑功能。 */
@Component({ tag: 'form-easy-array', styleUrl: 'form-easy-array.css' })
export class FormEasyArray {
  /** 数组字段定义。 */
  @Prop() field!: FormField;
  /** 数组字段的唯一标识。 */
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
  /** 当前数组值。 */
  @Prop() value: unknown;
  /** 共享事件路由器。 */
  @Prop() eventCenter: EventCenter = globalEventCenter;
  /** 当前表单共享的字段值存储。 */
  @Prop() formValueStore?: FormValueStore;
  /** 是否禁用数组修改。 */
  @Prop() disabled = false;
  /** 数组变更后触发新的数组值。 */
  @Event() valueChange!: EventEmitter<unknown[]>;
  /** 本地维护的数组项。 */
  @State() private items: unknown[] = [];
  /** 数组内容是否处于展开状态。 */
  @State() private expanded = true;
  /** 标记数组在本轮渲染完成后是否需要发布元素初始化事件。 */
  private shouldPublishInitialItemValues = false;

  /** 初始化可编辑的数组项列表。 */
  componentWillLoad(): void {
    this.items = this.normalizeArrayValue(this.value);
  }

  /** 全部初始数组元素挂载后发布当前值。 */
  componentDidLoad(): void {
    this.publishInitialItemValues();
  }

  /** 延迟到数组元素完成增删或外部同步后发布当前值。 */
  componentDidRender(): void {
    if (!this.shouldPublishInitialItemValues) return;
    this.shouldPublishInitialItemValues = false;
    this.publishInitialItemValues();
  }

  /** 外部值变化后同步本地数组，确保预设值和绑定赋值能够刷新元素。 */
  @Watch('value')
  syncExternalValue(newValue: unknown): void {
    this.items = this.normalizeArrayValue(newValue);
    this.shouldPublishInitialItemValues = true;
  }

  /** 添加一个空数组元素。 */
  private addItem = (): void => {
    this.expanded = true;
    this.items = [...this.items, this.defaultElementValue()];
    this.shouldPublishInitialItemValues = true;
    this.valueChange.emit(this.items);
  };

  /** 切换数组内容的展开状态。 */
  private toggleExpanded = (): void => {
    this.expanded = !this.expanded;
  };

  /** 根据索引删除一个数组元素。 */
  private removeItem = (index: number): void => {
    this.items = this.items.filter((_, itemIndex) => itemIndex !== index);
    this.shouldPublishInitialItemValues = true;
    this.valueChange.emit(this.items);
  };

  /** 为当前数组的直接元素发布 onChange 初始化事件。 */
  private publishInitialItemValues(): void {
    this.items.forEach((item, index) => {
      this.eventCenter.publish(`${this.fieldId}[${index}]`, 'onChange', item);
    });
  }
  /** 嵌套渲染器变更后替换对应元素。 */
  private changeItem = (index: number, event: CustomEvent<unknown>): void => {
    event.stopPropagation();
    this.items = this.items.map((item, itemIndex) =>
      itemIndex === index ? event.detail : item
    );
    this.valueChange.emit(this.items);
  };

  /** 将传入值规范化为独立的数组实例；非数组值按空数组处理。 */
  private normalizeArrayValue(value: unknown): unknown[] {
    return Array.isArray(value) ? [...value] : [];
  }

  /** 返回适合元素分类的空值。 */
  private defaultElementValue(): unknown {
    if (this.field.element?.category === 'array') return [];
    if (this.field.element?.category === 'object') return {};
    return this.field.element?.dataType === 'boolean' ? false : '';
  }

  /** 渲染数组项和编辑操作。 */
  render() {
    const element = this.field.element;
    if (!element) return <p class="error">数组字段缺少元素定义。</p>;

    return (
      <div class="array" part="array">
        <div class="array-toolbar">
          <button
            class="array-toggle"
            type="button"
            aria-expanded={String(this.expanded)}
            aria-label={this.expanded ? '收起数组内容' : '展开数组内容'}
            title={this.expanded ? '收起数组内容' : '展开数组内容'}
            onClick={this.toggleExpanded}
          >
            <svg
              class={{ 'array-toggle-icon': true, 'is-expanded': this.expanded }}
              aria-hidden="true"
              viewBox="0 0 20 20"
            >
              <path d="m7 5 5 5-5 5" />
            </svg>
            <span class="array-count">共 {this.items.length} 项</span>
          </button>
          <button
            class="array-action array-action--add"
            type="button"
            disabled={this.disabled}
            onClick={this.addItem}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20">
              <path d="M10 4v12M4 10h12" />
            </svg>
            添加一项
          </button>
        </div>

        <div class="array-content" hidden={!this.expanded}>
          {this.items.length === 0 && (
            <div class="array-empty">
              <button
                class="array-empty-action"
                type="button"
                disabled={this.disabled}
                aria-label="添加第一项"
                title="添加第一项"
                onClick={this.addItem}
              >
                <svg aria-hidden="true" viewBox="0 0 20 20">
                  <path d="M10 4v12M4 10h12" />
                </svg>
              </button>
              <p>暂无内容，点击加号添加第一项。</p>
            </div>
          )}

          <div class="array-items">
            {this.items.map((item, index) => (
              <section class="array-item" key={`${this.fieldId}[${index}]`}>
                <header class="array-item-header">
                  <span>第 {index + 1} 项</span>
                  <button
                    class="array-action array-action--remove"
                    type="button"
                    disabled={this.disabled}
                    aria-label={`删除第 ${index + 1} 项`}
                    title={`删除第 ${index + 1} 项`}
                    onClick={() => this.removeItem(index)}
                  >
                    <svg aria-hidden="true" viewBox="0 0 20 20">
                      <path d="M4 6h12M8 6V4h4v2m-6 0 1 10h6l1-10M8.5 9v4M11.5 9v4" />
                    </svg>
                    <span>删除</span>
                  </button>
                </header>
                <div class="array-item-content">
                  <form-easy-field
                    field={element}
                    fieldId={`${this.fieldId}[${index}]`}
                    formKey={this.formKey}
                    labelPosition={this.labelPosition}
                    basicFieldRenderer={this.basicFieldRenderer}
                    componentDataManager={this.componentDataManager}
                    endpointManager={this.endpointManager}
                    value={item}
                    eventCenter={this.eventCenter}
                    formValueStore={this.formValueStore}
                    parentDisabled={this.disabled}
                    onValueChange={(event: CustomEvent<unknown>) =>
                      this.changeItem(index, event)
                    }
                  />
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    );
  }
}
