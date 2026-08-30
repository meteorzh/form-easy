import { Component, Event, EventEmitter, h, Prop, State } from '@stencil/core';
import { componentRegistry, type ComponentRegistry } from '../../managers/component-registry';
import { EventCenter } from '../../managers/event-center';
import type { FormField, LabelPosition } from '../../types';

/** 将对象字段渲染为不含独立表单键和名称的嵌套表单。 */
@Component({ tag: 'form-easy-object', styleUrl: 'form-easy-object.css', shadow: true })
export class FormEasyObject {
  /** 子字段定义列表。 */
  @Prop() fields: FormField[] = [];
  /** 当前对象字段的标识前缀。 */
  @Prop() fieldId!: string;
  /** 所属表单的键。 */
  @Prop() formKey!: string;
  /** 字段标签相对于编辑器的位置。 */
  @Prop() labelPosition: LabelPosition = 'left';
  /** 当前对象值。 */
  @Prop() value: unknown;
  /** 共享事件路由器。 */
  @Prop() eventCenter: EventCenter = new EventCenter();
  /** 共享自定义组件注册中心。 */
  @Prop() registry: ComponentRegistry = componentRegistry;
  /** 是否禁用嵌套字段编辑。 */
  @Prop() disabled = false;
  /** 子字段变更后触发完整的嵌套对象。 */
  @Event() valueChange!: EventEmitter<Record<string, unknown>>;
  /** 本地维护的嵌套对象。 */
  @State() private objectValue: Record<string, unknown> = {};

  /** 初始化本地对象值。 */
  componentWillLoad(): void {
    this.objectValue = this.value && typeof this.value === 'object' && !Array.isArray(this.value)
      ? { ...(this.value as Record<string, unknown>) }
      : {};
  }
  /** 根据 schema 键更新嵌套子字段。 */
  private changeField = (key: string, event: CustomEvent<unknown>): void => {
    event.stopPropagation();
    this.objectValue = { ...this.objectValue, [key]: event.detail };
    this.valueChange.emit(this.objectValue);
  };

  /** 渲染嵌套对象中的全部字段。 */
  render() {
    return (
      <div class="object" part="object">
        {this.fields.map(field => field.key ? (
          <form-easy-field
            field={field}
            fieldId={`${this.fieldId}.${field.key}`}
            formKey={this.formKey}
            labelPosition={this.labelPosition}
            value={this.objectValue[field.key]}
            eventCenter={this.eventCenter}
            registry={this.registry}
            onValueChange={(event: CustomEvent<unknown>) => this.changeField(field.key!, event)}
          />
        ) : null)}
      </div>
    );
  }
}
