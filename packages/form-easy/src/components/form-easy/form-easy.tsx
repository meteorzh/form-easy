import { Component, Event, EventEmitter, h, Prop, State } from '@stencil/core';
import { globalEventCenter, type EventCenter } from '../../managers/event-center';
import type { BasicFieldRenderer } from '../../renderers/basic-field-renderer';
import type { FormChangeDetail, FormSchema, LabelPosition } from '../../types';

/** 根据 JSON schema 渲染完整动态表单。 */
@Component({
  tag: 'form-easy',
  styleUrl: 'form-easy.css'
})
export class FormEasy {
  /** 描述表单及其字段的 JSON schema。 */
  @Prop() schema!: FormSchema;
  /** 初始化完成后加载的表单预设值。 */
  @Prop() value?: Record<string, unknown>;
  /**
   * 当前表单的基础字段渲染器。
   * undefined 使用全局渲染器，null 强制使用默认 H5 渲染。
   */
  @Prop() basicFieldRenderer?: BasicFieldRenderer | null;
  /**
   * 当前表单使用的事件中心。
   * 未传入时使用全局共享事件中心；传入后可与其他表单隔离。
   */
  @Prop() eventCenter?: EventCenter;
  /** 每次值变更时触发字段和完整表单上下文。 */
  @Event() formChange!: EventEmitter<FormChangeDetail>;
  /** 当前完整表单数据。 */
  @State() private formData: Record<string, unknown> = {};

  /** 当前表单生效的字段标签位置。 */
  private get labelPosition(): LabelPosition {
    return this.schema.labelPosition ?? 'left';
  }

  /** 获取当前表单实际使用的事件中心。 */
  private get activeEventCenter(): EventCenter {
    return this.eventCenter ?? globalEventCenter;
  }

  /** 初始化第一阶段：挂载控件时先提供空表单数据。 */
  componentWillLoad(): void {
    this.formData = {};
  }

  /** 初始化第二阶段：按预设值或默认值写入字段数据。 */
  componentDidLoad(): void {
    const initialData = this.value === undefined
      ? this.createDefaultFormData(this.schema.fields)
      : this.createPresetFormData(this.schema.fields, this.value);
    this.applyFormData(initialData);
  }
  /** 顶层字段触发新值后更新该字段。 */
  private changeField = (
    key: string,
    fieldId: string,
    event: CustomEvent<unknown>
  ): void => {
    event.stopPropagation();
    this.formData = { ...this.formData, [key]: event.detail };
    this.formChange.emit({
      fieldId,
      value: event.detail,
      formData: this.formData
    });
  };

  /** 写入完整表单数据，并为每一个字段发布 onChange 初始化事件。 */
  private applyFormData(formData: Record<string, unknown>): void {
    this.formData = formData;
    this.publishFieldChanges(this.schema.fields, this.schema.key, formData);
  }

  /** 根据字段定义构造默认表单数据；无默认值的基础和数组字段为 null。 */
  private createDefaultFormData(fields: FormSchema['fields']): Record<string, unknown> {
    return Object.fromEntries(
      fields
        .filter(field => field.key)
        .map(field => [field.key!, this.createDefaultFieldValue(field)])
    );
  }

  /** 根据预设值构造完整表单数据；预设中缺失的字段一律为 null。 */
  private createPresetFormData(
    fields: FormSchema['fields'],
    presetData: Record<string, unknown>
  ): Record<string, unknown> {
    return Object.fromEntries(
      fields
        .filter(field => field.key)
        .map(field => {
          const hasPresetValue = Object.prototype.hasOwnProperty.call(presetData, field.key!);
          const presetValue = hasPresetValue ? presetData[field.key!] : null;
          return [field.key!, this.createPresetFieldValue(field, presetValue)];
        })
    );
  }

  /** 根据字段分类规范化单个预设值。 */
  private createPresetFieldValue(
    field: FormSchema['fields'][number],
    presetValue: unknown
  ): unknown {
    if (field.category === 'object') {
      return this.isRecord(presetValue)
        ? this.createPresetFormData(field.fields ?? [], presetValue)
        : null;
    }
    if (field.category === 'array' && Array.isArray(presetValue)) {
      return presetValue.map(item => this.createPresetArrayElementValue(field, item));
    }
    return presetValue === undefined ? null : this.cloneValue(presetValue);
  }

  /** 根据数组元素定义规范化对象元素中的预设子字段。 */
  private createPresetArrayElementValue(
    field: FormSchema['fields'][number],
    presetValue: unknown
  ): unknown {
    const element = field.element;
    if (element?.category === 'object') {
      return this.isRecord(presetValue)
        ? this.createPresetFormData(element.fields ?? [], presetValue)
        : null;
    }
    return presetValue === undefined ? null : this.cloneValue(presetValue);
  }

  /** 根据字段分类与 defaultValue 配置构造字段默认值。 */
  private createDefaultFieldValue(field: FormSchema['fields'][number]): unknown {
    if (Object.prototype.hasOwnProperty.call(field, 'defaultValue')) {
      return this.cloneValue(field.defaultValue);
    }
    if (field.category === 'object') {
      return this.createDefaultFormData(field.fields ?? []);
    }
    return null;
  }

  /** 深复制 JSON 结构的数组或对象值。 */
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

  /** 判断值是否为可合并的普通对象记录。 */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  /** 递归发布字段的 onChange 事件，使初始化绑定立即生效。 */
  private publishFieldChanges(
    fields: FormSchema['fields'],
    parentFieldId: string,
    data: Record<string, unknown>
  ): void {
    fields.forEach(field => {
      if (!field.key) return;

      const fieldId = `${parentFieldId}.${field.key}`;
      const fieldValue = data[field.key] ?? null;
      this.activeEventCenter.publish(fieldId, 'onChange', fieldValue);

      if (field.category === 'object' && this.isRecord(fieldValue)) {
        this.publishFieldChanges(field.fields ?? [], fieldId, fieldValue);
      }
      if (field.category === 'array' && Array.isArray(fieldValue)) {
        this.publishArrayElementChanges(field, fieldId, fieldValue);
      }
    });
  }

  /** 递归发布数组元素及其对象子字段的 onChange 事件。 */
  private publishArrayElementChanges(
    field: FormSchema['fields'][number],
    fieldId: string,
    items: unknown[]
  ): void {
    const element = field.element;
    if (!element) return;

    items.forEach((item, index) => {
      const elementId = `${fieldId}[${index}]`;
      this.activeEventCenter.publish(elementId, 'onChange', item);
      if (element.category === 'object' && this.isRecord(item)) {
        this.publishFieldChanges(element.fields ?? [], elementId, item);
      }
    });
  }

  /** 渲染表单标题和全部顶层字段渲染器。 */
  render() {
    const schema = this.schema;
    const fields = Array.isArray(schema?.fields) ? schema.fields : [];

    return (
      <form part="form" novalidate>
        <h2>{schema?.name}</h2>
        {fields.map(field => field.key ? (
          <form-easy-field
            field={field}
            fieldId={`${schema.key}.${field.key}`}
            formKey={schema.key}
            labelPosition={this.labelPosition}
            basicFieldRenderer={this.basicFieldRenderer}
            value={this.formData[field.key]}
            eventCenter={this.activeEventCenter}
            onValueChange={(event: CustomEvent<unknown>) =>
              this.changeField(field.key!, `${schema.key}.${field.key}`, event)
            }
          />
        ) : null)}
      </form>
    );
  }
}
